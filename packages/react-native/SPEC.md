# React Native Plumbing — Specification

> How the engine kernel connects to React Native. This document covers the bridge layer between `@engine/kernel` (pure, runtime-agnostic) and the React Native runtime (Skia rendering, gesture input, worklet lifecycle).
>
> Unlike the kernel spec, which defines mathematical invariants, this spec documents **integration contracts** — what components exist, how they wire together, and what guarantees they provide.

---

## Runtime Model

### Thread Architecture

The engine runs entirely on the **UI worklet thread** — the default worklet runtime provided by react-native-reanimated.

```
┌──────────────────────┐
│   JS Thread (React)  │
│                      │
│  Scene declaration   │
│  State management    │
│  Command source      │
└──────────┬───────────┘
           │ SharedValue / runOnJS
┌──────────▼───────────┐
│   UI Thread (Worklet) │
│                       │
│  Engine kernel        │  ← world.step(dt)
│  Input processing     │  ← InputSystem reads InputBuffer
│  Transform propagation│  ← world transforms computed
│  Render collection    │  ← RenderBuffer populated
│  Skia rendering       │  ← Atlas draws from RenderBuffer
│  Gesture callbacks    │  ← writes to InputBuffer
└───────────────────────┘
```

### Why UI Thread (Not Worker Thread)

The engine was originally designed for a worker worklet runtime (`createWorkletRuntime`). This was changed for three reasons:

1. **Synchronous rendering**: Kernel output (RenderBuffer) is consumed by Skia hooks on the same thread — no cross-thread serialization, no SharedValue cloning, no frame-of-latency delay.
2. **Synchronous input**: Gesture data lands on the UI thread. Kernel reads it directly — no async snapshot.
3. **No transport problem**: No SharedValue throughput ceiling, no triple-buffering, no Nitro module dependency.

See [runtime_target_change.md](../../docs/runtime_target_change.md) for the full historical decision record.

### What Did Not Change

- The kernel code itself (factories, SoA storage, systems, command buffer)
- The closure-factory architecture (worklet serialization still strips prototypes)
- `'worklet'` directives (still required for Babel plugin serialization)
- All kernel tests (runtime-agnostic — 203 pass in Jest)

### Authority Model

The kernel is the **sole owner** of simulation state. Other layers are constrained:

| Layer | Role | Owns state? |
|---|---|---|
| Kernel (`@engine/kernel`) | Simulation authority | **Yes** — nodes, components, transforms, physics |
| Plumbing (`@engine/react-native`) | Bridge / lifecycle | No — wires kernel to RN primitives |
| React (JS thread) | Scene declaration, UI | No — sends commands, receives projections |
| Skia (UI thread) | GPU rendering | No — reads RenderBuffer snapshots |

---

## Rendering Pipeline

### Overview

```
SpritePool → RenderCollectionSystem → RenderBuffer → useRSXformBuffer/useRectBuffer → <Atlas>
   ↑ kernel                             ↑ kernel output    ↑ plumbing                    ↑ Skia
```

### Frame Invalidation

A `frameVersion` SharedValue increments after every `world.step(dt)`. Skia buffer hooks (`useRSXformBuffer`, `useRectBuffer`) read this value as a dependency — they re-execute their callbacks whenever it changes.

```typescript
// Inside useFrameCallback:
engine.world.step(dt);
frameVersion.value += 1;  // triggers Skia buffer re-evaluation

// Inside useRSXformBuffer callback:
frameVersion.value;  // dependency trigger — re-run on change
```

### Atlas Buffer Bridge

Two Skia buffer hooks translate the kernel's RenderBuffer into Atlas-compatible format:

- **`useRSXformBuffer`**: Reads `buffer.transforms` (Float32Array of `[a, b, tx, ty]` quads) into RSXform values.
- **`useRectBuffer`**: Reads `buffer.spriteTypes` (Int32Array) and maps each type to a source rectangle in the spritesheet.

Both callbacks access the engine via `globalThis` on the UI worklet thread.

### Sprite Pivot Correction (planned)

Currently, sprite transforms position sprites at their top-left corner. The render collection system needs to account for sprite dimensions and pivot points to enable center-based positioning. This requires:

- A `SpriteAtlasLookup` structure mapping sprite types to dimensions and pivots
- Pivot offset applied during render collection (kernel-side, in the gather operation)

---

## Input Pipeline

> Kernel side: **built and tested** (two-buffer design below, `packages/kernel/src/flat_tree/`).
> Plumbing bridge and query layer: **not yet built** (todo.md 2.1, 3.3).
> Contract details and invariants: [packages/kernel/TouchSpec.md](../kernel/TouchSpec.md).

### Architecture (as implemented)

```
Gesture.Manual() → TouchEventBuffer (raw events) → beginInputFrame (cook) → TouchState → [user systems read]
     ↑ plumbing writes via writeTouch*              ↑ first system                        ↑ query layer (unbuilt)
                                                    endInputFrame (last system) clears transient flags, frees ended slots
```

All on the UI thread. No bridge, no serialization.

### Two buffers, not one

- **`TouchEventBuffer`** — raw facts written by the gesture side via the producer interface (`writeTouchDown/Move/Up/Cancel`). Fixed `MAX_TOUCHES = 10` slots; overflow throws. Phase is represented as **per-frame boolean flag arrays** (`beganThisFrame`, `movedThisFrame`, `endedThisFrame`, `canceledThisFrame`) — events, not a phase enum or state machine.
- **`TouchState`** — the cooked per-frame snapshot gameplay systems read: current position, start position/time, previous-frame position (for deltas), visibility flags, `visibleTouchCount`.

### Frame bookends (kernel systems)

- **`createBeginInputFrame(buffer, state)`** — runs FIRST: copies events into `TouchState`, initializes start position/time on begin, tracks prev position for deltas.
- **`createEndInputFrame(buffer, state)`** — runs LAST: clears transient flags in both buffers, frees slots of ended/cancelled touches. Ended/cancelled touches are visible for exactly one frame.

### Gesture Source (plumbing side — todo 3.3)

`Gesture.Manual()` wraps `<Canvas>` via `<GestureDetector>`. Four raw callbacks (`onTouchesDown`, `onTouchesMove`, `onTouchesUp`, `onTouchesCancelled`) call `writeTouch*` on the `TouchEventBuffer` — same thread, synchronous.

### Query layer (kernel side — todo 2.1, unbuilt)

Pure functions over `TouchState`: delta, drag-from-start, velocity, duration, tap/drag detection. Pinch and long-press deferred until a game pulls them.

---

## Engine Lifecycle

### Bootstrap

The engine is created inside the first `useFrameCallback` tick and stored on `globalThis`:

```typescript
useFrameCallback((frame) => {
    'worklet';
    const g = globalThis as any;
    if (!g[ENGINE_ID] && initialized.value) {
        const world = createFlatWorld(MAX_NODES);
        // ... register pools, systems, spawn entities
        g[ENGINE_ID] = { world, spritePool, buffer, ... };
    }
    // ... tick engine
});
```

### System Registration Order

Order matters. Recommended:

```
1. beginInputFrame      ← cook TouchEventBuffer into TouchState
2. [user systems]       ← read TouchState, update game state
3. TransformPropagation ← compose world transforms
4. RenderCollection     ← gather visible sprites into RenderBuffer
5. endInputFrame        ← clear transient flags, free ended touch slots
```

### Frame Loop

Driven by `useFrameCallback` (react-native-reanimated). Each frame:

1. Dynamic entity management (spawn/destroy based on target count)
2. `world.step(dt)` — runs all systems, flushes command buffer
3. `frameVersion.value += 1` — triggers Skia buffer re-evaluation

---

## Contracts

### What the plumbing guarantees to the kernel

- TouchEventBuffer is populated before `beginInputFrame` runs (gesture callbacks fire between frames on the UI thread; same-thread execution means writes never interleave with a running `step()`)
- `world.step(dt)` is called exactly once per frame
- `dt` is derived from `useFrameCallback`'s `frame.timeSincePreviousFrame`

### What the kernel guarantees to the plumbing

- RenderBuffer is valid and fully populated after `step()` returns
- `buffer.count` reflects the exact number of visible sprites
- Transform and spriteType arrays are contiguous in `0..count-1`
- `step()` allocation is measured and reported honestly (see todo.md 6.1); zero-GC in hot paths is a hygiene target, not a current guarantee

### What the plumbing guarantees to React

- `runOnJS` callbacks deliver perf stats and state updates
- SharedValues carry signals (frameVersion, initialized) but never simulation data
- React never touches `globalThis` engine state directly

---

## Dependencies

| Package | Purpose | Required by |
|---|---|---|
| `@engine/kernel` | Engine core | Direct dependency |
| `@shopify/react-native-skia` | Atlas rendering | Peer dependency |
| `react-native-reanimated` | Worklet runtime, useFrameCallback | Peer dependency |
| `react-native-gesture-handler` | Touch input via Gesture.Manual() | Peer dependency |
| `react-native-worklets` | scheduleOnRN, worklet utilities | Peer dependency |
