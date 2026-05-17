# v0 Execution Plan — Sprites on Screen (UI Worklet Runtime)

> End-to-end steps from current state to a running demo: kernel ticking on the UI thread, Skia Atlas drawing sprites, driven by `useFrameCallback`.

---

## Step 1: Create the Runtime Environment

### Decision: Branch of this repo, not a separate repo

Creating a new Expo app inside this repo (as a subdirectory) is trivial and keeps kernel source co-located with the integration code. The kernel tests continue to run at the root. The app lives in `app/`.

```
react-native-game-engine-PROTO/
├── src/              ← kernel (unchanged)
├── app/              ← Expo app (new)
│   ├── App.tsx
│   ├── engine/       ← kernel copies with 'worklet' directives
│   └── ...
├── package.json      ← kernel tests (unchanged)
└── spec.md, plan.md  ← docs
```

### Steps

1. **Create a branch**: `git checkout -b v0-ui-worklet`
2. **Scaffold the Expo app** inside `app/`:
   ```bash
   cd react-native-game-engine-PROTO
   npx -y create-expo-app@latest app --template blank-typescript
   ```
3. **Install dependencies** in `app/`:
   ```bash
   cd app
   npx expo install @shopify/react-native-skia react-native-reanimated react-native-worklets-core
   ```
4. **Configure Reanimated Babel plugin** — add to `app/babel.config.js`:
   ```js
   plugins: ['react-native-reanimated/plugin']
   ```
5. **Copy kernel source** into `app/engine/`:
   ```bash
   cp -r ../src/flat_tree app/engine/
   cp ../src/index.ts app/engine/
   ```
6. **Add `'worklet'` directives** to every factory function and `refEquals` in the copied files (same list as A3 audit, plus `createSpritePool` and `createRenderCollectionSystem`'s inner system closure).
7. **Verify the app boots**: `cd app && npx expo start` → confirm blank screen on device/simulator.

> [!NOTE]
> The kernel source is **copied**, not imported from `../src`. The Reanimated Babel plugin only processes `'worklet'` directives in app source, not external paths. This matches the strategy documented in `plan.md` ("Kernel packaging").

---

## Step 2: Create a Spritesheet

The Atlas requires a single texture (spritesheet) and a list of source rectangles defining each sprite frame.

1. **Create or acquire a simple spritesheet** — a PNG with a grid of sprite frames (e.g., 4×4 grid of 64×64 colored squares). For v0, visual variety doesn't matter — distinct colors prove correct sprite-type indexing.
2. **Place it** at `app/assets/spritesheet.png`.
3. **Define the sprite source rects** as a constant:
   ```typescript
   // app/sprites.ts
   import { rect } from '@shopify/react-native-skia';

   const FRAME_SIZE = 64;
   const COLS = 4;

   export const SPRITE_RECTS = [
     rect(0 * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE),  // type 0
     rect(1 * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE),  // type 1
     rect(2 * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE),  // type 2
     rect(3 * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE),  // type 3
   ];
   ```

---

## Step 3: Initialize the Engine on the UI Thread

The engine is created inside a worklet callback and stored on `globalThis`. No `createWorkletRuntime` — just the default UI worklet context.

```typescript
// app/useEngine.ts
import { useEffect } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { createFlatWorld } from './engine';
import { createSpritePool } from './engine';

const ENGINE_ID = '__engine_v0';
const MAX_NODES = 512;
const MAX_SPRITES = 256;

export function useEngineInit() {
  const initialized = useSharedValue(false);

  useEffect(() => {
    // This runs on JS thread, but the actual engine setup
    // happens in the first frame callback (worklet context).
    // We just signal that init should happen.
    initialized.value = true;
  }, []);

  return { initialized, engineId: ENGINE_ID };
}
```

Engine bootstrap happens inside the first `useFrameCallback` tick:

```typescript
// Inside useFrameCallback:
'worklet';
const g = globalThis as any;
if (!g[ENGINE_ID] && initialized.value) {
  // Bootstrap — runs once on UI thread
  const world = createFlatWorld(MAX_NODES);
  const { pool: spritePool, spriteType } = createSpritePool(world, MAX_SPRITES);
  world.registerPool(spritePool);

  const propagation = world.createTransformPropagationSystem();
  world.addSystem(propagation);

  const { system: renderSystem, buffer } =
    world.createRenderCollectionSystem(spritePool, spriteType);
  world.addSystem(renderSystem);

  // --- Scene setup: spawn N sprites ---
  const root = world.root;
  for (let i = 0; i < SPRITE_COUNT; i++) {
    const node = world.createNode();
    world.attach(node, root);
    spritePool.add(node);
    spriteType[spritePool.get(node)] = i % 4; // cycle through types
    world.setLocalPosition(node, Math.random() * SCREEN_W, Math.random() * SCREEN_H);
  }

  // Store a velocity system or velocity data for the demo
  const vx = new Float32Array(MAX_SPRITES);
  const vy = new Float32Array(MAX_SPRITES);
  for (let i = 0; i < SPRITE_COUNT; i++) {
    vx[i] = (Math.random() - 0.5) * 200;
    vy[i] = (Math.random() - 0.5) * 200;
  }

  // Movement system (bouncing sprites)
  world.addSystem((w, dt) => {
    'worklet';
    for (let i = 0; i < spritePool.count; i++) {
      const handle = spritePool.getNodeHandle(i);
      const t = w.getLocalTransform(handle);
      let nx = t.tx + vx[i] * dt;
      let ny = t.ty + vy[i] * dt;
      // Bounce
      if (nx < 0 || nx > SCREEN_W) { vx[i] *= -1; nx = Math.max(0, Math.min(SCREEN_W, nx)); }
      if (ny < 0 || ny > SCREEN_H) { vy[i] *= -1; ny = Math.max(0, Math.min(SCREEN_H, ny)); }
      w.setLocalPosition(handle, nx, ny);
    }
  });

  // Note: addSystem after propagation+render means movement runs BEFORE them
  // Reorder: movement should be first. Rebuild system order:
  // Actually — systems run in registration order.
  // Register: propagation, renderCollection, then movement → wrong order.
  // Fix: register movement FIRST, then propagation, then render collection.
  // This means we need to restructure the init to register in correct order.

  g[ENGINE_ID] = { world, spritePool, spriteType, buffer, vx, vy };
}
```

> [!IMPORTANT]
> System registration order matters. The correct order is:
> 1. User systems (movement)
> 2. Transform propagation
> 3. Render collection
>
> Structure init accordingly.

---

## Step 4: Frame Loop via `useFrameCallback`

```typescript
// app/GameScreen.tsx
import { useFrameCallback } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';

const frameVersion = useSharedValue(0);

useFrameCallback((frame) => {
  'worklet';

  const g = globalThis as any;
  const engine = g[ENGINE_ID];
  if (!engine) return;

  const dt = frame.timeSincePreviousFrame == null
    ? 0
    : frame.timeSincePreviousFrame / 1000;

  engine.world.step(dt);

  frameVersion.value += 1;
});
```

The `frameVersion` SharedValue increments every frame, serving as an invalidation signal for the Skia buffer hooks.

---

## Step 5: Skia Atlas Rendering

```typescript
// app/GameScreen.tsx
import { Canvas, Atlas, useImage, useRSXformBuffer, useRectBuffer } from '@shopify/react-native-skia';
import { SPRITE_RECTS } from './sprites';

const MAX_SPRITES = 256;
const SPRITE_COUNT = 100; // start conservative

export function GameScreen() {
  const image = useImage(require('./assets/spritesheet.png'));

  const transforms = useRSXformBuffer(MAX_SPRITES, (val, i) => {
    'worklet';

    frameVersion.value; // dependency trigger — re-run when frame changes

    const g = globalThis as any;
    const engine = g[ENGINE_ID];
    if (!engine || i >= engine.buffer.count) {
      // Off-screen or inactive — zero scale hides it
      val.set(0, 0, -9999, -9999);
      return;
    }

    const base = i * 4;
    val.set(
      engine.buffer.transforms[base],     // scos
      engine.buffer.transforms[base + 1], // ssin
      engine.buffer.transforms[base + 2], // tx
      engine.buffer.transforms[base + 3], // ty
    );
  });

  const sprites = useRectBuffer(MAX_SPRITES, (val, i) => {
    'worklet';

    frameVersion.value; // dependency trigger

    const g = globalThis as any;
    const engine = g[ENGINE_ID];
    if (!engine || i >= engine.buffer.count) {
      val.setXYWH(0, 0, 0, 0);
      return;
    }

    const type = engine.buffer.spriteTypes[i];
    const FRAME_SIZE = 64;
    val.setXYWH(type * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE);
  });

  if (!image) return null;

  return (
    <Canvas style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
      <Atlas
        image={image}
        sprites={sprites}
        transforms={transforms}
      />
    </Canvas>
  );
}
```

> [!NOTE]
> `useRectBuffer` is used instead of a static `SPRITE_RECTS` array because sprite types can change dynamically (the render buffer's `spriteTypes` array is written per-frame by the render collection system).

---

## Step 6: Wire It All Together

`app/App.tsx`:

```tsx
import { GameScreen } from './GameScreen';

export default function App() {
  return <GameScreen />;
}
```

**Run it:**
```bash
cd app
npx expo run:ios
# or
npx expo run:android
```

### What "success" looks like
- Colored squares bouncing around the screen
- Smooth 60fps (or close to it)
- No crashes, no blank frames after init

---

## Step 7: Testing & Benchmarking

### 7.1 — Validation Tests (does it work?)

These are binary pass/fail. Run them first before any perf work.

| # | Test | How to verify | Proves |
|---|------|--------------|--------|
| V1 | `globalThis` persistence | Log `globalThis.__engine_v0` in consecutive `useFrameCallback` ticks. Should be the same object reference | Engine state survives across frames on UI worklet |
| V2 | `useRSXformBuffer` reactivity | Sprites move on screen when `frameVersion.value` increments | SharedValue change triggers buffer rebuild on same frame (or next — measure which) |
| V3 | Render buffer correctness | Freeze velocities to 0. Set known positions. Screenshot and verify sprite positions match | Kernel → RenderBuffer → Atlas pipeline produces correct output |
| V4 | `worldEnabled` visibility | Disable a sprite node mid-run. It should disappear from screen | Render collection skips disabled nodes, Atlas reflects it |
| V5 | Dynamic spawn/destroy | Add a button that spawns/destroys sprites. Count on screen should match `spritePool.count` | Full lifecycle works on UI worklet |

### 7.2 — Performance Tests (is it fast enough?)

| # | Test | What to measure | Target | Failure threshold |
|---|------|----------------|--------|-------------------|
| P1 | Frame budget — 100 sprites | `frame.timeSincePreviousFrame` logged per frame | < 16.6ms consistently | > 20ms average |
| P2 | Frame budget — 500 sprites | Same | < 16.6ms | > 20ms average |
| P3 | Frame budget — 1000 sprites | Same | < 16.6ms (stretch) | > 25ms |
| P4 | `world.step(dt)` isolation | `performance.now()` before/after `world.step(dt)` inside `useFrameCallback` | < 4ms for 500 sprites | > 8ms |
| P5 | Skia draw time | Total frame time minus step time | Identify if bottleneck is kernel or rendering | — |

### 7.3 — Stress Test: Physics Simulation

After V1–V5 and P1–P3 pass, add a heavier system to stress the kernel:

1. **Gravity + bounce**: Replace random velocities with gravity (`vy += 980 * dt`), floor bounce (`if y > SCREEN_H, vy *= -0.8`).
2. **Naive O(n²) collision**: For each sprite pair, check distance. If overlapping, push apart. This is intentionally expensive — it tells us where the ceiling is.
3. **Measure P4 again** with collision enabled. The delta between "no collision" and "collision" isolates the cost of the collision system vs kernel overhead.

The purpose is NOT to ship O(n²) collision. It's to find where the frame budget breaks so we know:
- How many sprites the kernel can handle before systems become the bottleneck
- Whether a spatial index (grid, quadtree) is needed at what entity count
- Whether the kernel's SoA iteration overhead is negligible relative to system logic (it should be)

---

## File Checklist

| File | Purpose | Status |
|------|---------|--------|
| `app/` (directory) | Expo app | Create |
| `app/engine/` | Kernel copies with `'worklet'` directives | Copy + modify |
| `app/assets/spritesheet.png` | 4×4 grid of colored squares, 256×256 | Create or generate |
| `app/sprites.ts` | Sprite source rect definitions | Create |
| `app/useEngine.ts` | Engine init hook | Create |
| `app/GameScreen.tsx` | Frame loop + Atlas rendering | Create |
| `app/App.tsx` | Entry point | Modify |

---

## What's Deferred (v0.1)

- **Input** — gesture handler → engine. Next priority after v0 proves rendering.
- **React scene API** — declarative JSX. Blocked on input proving the full loop.
- **Nitro native buffer** — only needed if SharedValue throughput caps out (may not, since we're on the same thread now).
- **Animation system** — sprite frame cycling. Pure kernel work, can be added after v0.
