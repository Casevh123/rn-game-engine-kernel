# Getting Started

A step-by-step guide to building a game with this engine. By the end, you'll have sprites rendering on screen driven by a kernel running on the UI worklet thread.

---

## Prerequisites

- **Node.js** ≥ 18
- **Expo CLI** (`npx expo`)
- **iOS Simulator** or physical device (Android works too, but iOS is the primary target)
- **Xcode** (for iOS builds)

---

## 1. Create an Expo App

```bash
npx -y create-expo-app@latest my-game --template blank-typescript
cd my-game
```

## 2. Install Dependencies

```bash
npx expo install @shopify/react-native-skia react-native-reanimated react-native-gesture-handler react-native-worklets
```

## 3. Install the Engine

If you're working inside this monorepo:

```bash
# The engine packages are available as workspace dependencies
# Add to your app's package.json:
#   "@engine/kernel": "*"
#   "@engine/react-native": "*"
# Then run npm install from the repo root
```

If you're in a standalone project (future — when packages are published):

```bash
npm install @engine/kernel @engine/react-native
```

## 4. Configure Babel

The Reanimated Babel plugin is required to process `'worklet'` directives. Expo SDK 54+ includes this automatically via the `expo-router` preset, but if you need to add it manually:

```js
// babel.config.js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

## 5. Create a Spritesheet

Place a spritesheet image at `assets/spritesheet.png`. A simple grid of colored squares works for testing — each cell is one sprite type.

Define the sprite metadata:

```typescript
// sprites.ts
export const FRAME_SIZE = 64;  // width/height of each sprite frame
export const NUM_SPRITE_TYPES = 4;
```

## 6. Build Your First Scene

This is the minimal code to get the engine running with sprites on screen.

```typescript
// GameScreen.tsx
import React, { useEffect } from 'react';
import { Dimensions, View } from 'react-native';
import { Canvas, Atlas, useImage, useRSXformBuffer, useRectBuffer } from '@shopify/react-native-skia';
import { useSharedValue, useFrameCallback } from 'react-native-reanimated';
import { createFlatWorld, createSpritePool, SpriteAtlasLookup } from '@engine/kernel';
import { FRAME_SIZE, NUM_SPRITE_TYPES } from './sprites';

const ENGINE_ID = '__engine';
const MAX_NODES = 512;
const MAX_SPRITES = 256;
const SPRITE_COUNT = 50;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export function GameScreen() {
    const image = useImage(require('./assets/spritesheet.png'));
    const frameVersion = useSharedValue(0);
    const initialized = useSharedValue(false);

    useEffect(() => { initialized.value = true; }, []);

    // ─── Frame loop ────────────────────────────────────────────────────
    useFrameCallback((frame) => {
        'worklet';
        const g = globalThis as any;

        // Bootstrap engine (runs once)
        if (!g[ENGINE_ID] && initialized.value) {
            const world = createFlatWorld(MAX_NODES);
            const { pool: spritePool, spriteType } = createSpritePool(world, MAX_SPRITES);
            world.registerPool(spritePool);

            // Velocity data (user-owned)
            const vx = new Float32Array(MAX_SPRITES);
            const vy = new Float32Array(MAX_SPRITES);

            // Movement system
            world.addSystem((w, dt) => {
                'worklet';
                for (let i = 0; i < spritePool.count; i++) {
                    const handle = spritePool.getNodeHandle(i);
                    const t = w.getLocalTransform(handle);
                    let nx = t.tx + vx[i] * dt;
                    let ny = t.ty + vy[i] * dt;
                    // Bounce off walls
                    if (nx < 0 || nx > SCREEN_W) { vx[i] *= -1; nx = Math.max(0, Math.min(SCREEN_W, nx)); }
                    if (ny < 0 || ny > SCREEN_H) { vy[i] *= -1; ny = Math.max(0, Math.min(SCREEN_H, ny)); }
                    w.setLocalPosition(handle, nx, ny);
                }
            });

            // Atlas metadata: dimensions + normalized pivot per sprite type
            // (0.5, 0.5) = centered pivot — the node's position is the sprite's center
            const atlas: SpriteAtlasLookup = {
                widths:  new Float32Array(NUM_SPRITE_TYPES).fill(FRAME_SIZE),
                heights: new Float32Array(NUM_SPRITE_TYPES).fill(FRAME_SIZE),
                pivotXs: new Float32Array(NUM_SPRITE_TYPES).fill(0.5),
                pivotYs: new Float32Array(NUM_SPRITE_TYPES).fill(0.5),
            };

            // Engine systems (order matters!)
            world.addSystem(world.createTransformPropagationSystem());
            const { system: renderSystem, buffer } =
                world.createRenderCollectionSystem(spritePool, spriteType, atlas);
            world.addSystem(renderSystem);

            // Spawn sprites
            for (let i = 0; i < SPRITE_COUNT; i++) {
                const node = world.createNode();
                world.attach(node, world.root);
                const idx = spritePool.add(node);
                spriteType[idx] = i % 4;
                world.setLocalPosition(node, Math.random() * SCREEN_W, Math.random() * SCREEN_H);
                vx[idx] = (Math.random() - 0.5) * 200;
                vy[idx] = (Math.random() - 0.5) * 200;
            }

            g[ENGINE_ID] = { world, spritePool, spriteType, buffer, vx, vy };
        }

        // Tick
        const engine = g[ENGINE_ID];
        if (!engine) return;

        const dt = frame.timeSincePreviousFrame == null
            ? 0 : frame.timeSincePreviousFrame / 1000;

        engine.world.step(dt);
        frameVersion.value += 1;
    });

    // ─── Skia Atlas buffers ────────────────────────────────────────────
    const transforms = useRSXformBuffer(MAX_SPRITES, (val, i) => {
        'worklet';
        frameVersion.value;
        const engine = (globalThis as any)[ENGINE_ID];
        if (!engine || i >= engine.buffer.count) {
            val.set(0, 0, -9999, -9999);
            return;
        }
        const base = i * 4;
        val.set(
            engine.buffer.transforms[base],
            engine.buffer.transforms[base + 1],
            engine.buffer.transforms[base + 2],
            engine.buffer.transforms[base + 3],
        );
    });

    const sprites = useRectBuffer(MAX_SPRITES, (val, i) => {
        'worklet';
        frameVersion.value;
        const engine = (globalThis as any)[ENGINE_ID];
        if (!engine || i >= engine.buffer.count) {
            val.setXYWH(0, 0, 0, 0);
            return;
        }
        const type = engine.buffer.spriteTypes[i];
        val.setXYWH(type * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE);
    });

    if (!image) return null;

    return (
        <View style={{ flex: 1 }}>
            <Canvas style={{ flex: 1, backgroundColor: '#1a1a2e' }}>
                <Atlas image={image} sprites={sprites} transforms={transforms} />
            </Canvas>
        </View>
    );
}
```

## 7. Wire It Up

```typescript
// App.tsx
import { GameScreen } from './GameScreen';

export default function App() {
    return <GameScreen />;
}
```

Run it:

```bash
npx expo run:ios
```

You should see colored squares bouncing around the screen at 60fps.

---

## System Registration Order

**Order matters.** Systems run sequentially in the order they're registered. The recommended order is:

```
1. InputSystem          ← process input (when implemented)
2. [your systems]       ← movement, physics, game logic
3. TransformPropagation ← compose world transforms from local transforms
4. RenderCollection     ← gather visible sprites into RenderBuffer
```

Why: Your systems write to local transforms. Propagation computes world transforms from those locals. Render collection reads world transforms and populates the RenderBuffer that Skia draws from.

---

## Adding Custom Systems

A system is just a function `(world, dt) → void`. It reads and writes pool data.

```typescript
// Create your own data arrays
const health = new Float32Array(MAX_SPRITES);

// Create a system that uses them
const healthSystem = (world: FlatWorld, dt: number) => {
    'worklet';
    for (let i = 0; i < spritePool.count; i++) {
        health[i] -= 10 * dt; // drain health
        if (health[i] <= 0) {
            const handle = spritePool.getNodeHandle(i);
            world.commandBuffer.destroy(handle); // deferred — safe during step
        }
    }
};

// Register BEFORE propagation and render collection
world.addSystem(healthSystem);
```

**Key rules:**
- Don't call `world.destroy()`, `attach()`, `detach()`, or `reparent()` directly during step — use `world.commandBuffer`
- Treat `world.createNode()` and `pool.add()` / `pool.remove()` as forbidden during step too. They are not yet runtime-guarded, but mutating a pool mid-step corrupts iteration — spawn and add components outside `step()` (guards + command-buffer support are scheduled, see todo.md 1.2)
- Systems close over their data — this is the intended pattern

---

## Creating Component Pools

For custom component types beyond sprites:

```typescript
import { createComponentPool } from '@engine/kernel';

// Your data arrays
const vx = new Float32Array(256);
const vy = new Float32Array(256);

// Pool with swap callback (called during removal to keep data dense)
const velocityPool = createComponentPool(world, 256, (a, b) => {
    'worklet';
    let tmp = vx[a]; vx[a] = vx[b]; vx[b] = tmp;
    tmp = vy[a]; vy[a] = vy[b]; vy[b] = tmp;
});

world.registerPool(velocityPool);

// Add a component to a node
const idx = velocityPool.add(nodeHandle);
vx[idx] = 100;
vy[idx] = -50;
```

**Important:** Your swap callback must swap ALL your data arrays. If you add a new array and forget to update the swap function, data will silently corrupt on removal.

---

## Next Steps

- Read the [Kernel Specification](packages/kernel/SPEC.md) for the full invariant model
- Read the [Plumbing Specification](packages/react-native/SPEC.md) for how the rendering pipeline works
- Check the [Plan](plan.md) for direction and [todo.md](todo.md) for what's being built next
- Look at `apps/demo/GameScreen.tsx` for a full working example with gravity, collision, and perf monitoring
