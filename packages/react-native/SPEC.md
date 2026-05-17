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

## Input Pipeline (planned)

### Architecture

```
Gesture.Manual() → InputBuffer (write) → InputSystem (process) → Utility functions (query)
     ↑ plumbing side                      ↑ kernel side ────────────────────────────────→
```

All on the UI thread. No bridge, no serialization.

### InputBuffer

World-level singleton. TypedArray-backed:

```typescript
interface InputBuffer {
    touchX:      Float32Array;  // [MAX_TOUCHES] — view-relative x
    touchY:      Float32Array;  // [MAX_TOUCHES] — view-relative y
    touchPhase:  Int32Array;    // [MAX_TOUCHES] — phase enum
    touchId:     Int32Array;    // [MAX_TOUCHES] — OS pointer id
    activeTouchCount: number;   // plain number
}
```

Phase constants: `NONE=0, BEGAN=1, MOVED=2, ENDED=3, CANCELLED=4`.

### Gesture Source (plumbing side)

`Gesture.Manual()` wraps `<Canvas>` via `<GestureDetector>`. Four raw callbacks (`onTouchesDown`, `onTouchesMove`, `onTouchesUp`, `onTouchesCancelled`) write directly to the InputBuffer — same thread, synchronous.

### InputSystem (kernel side)

Engine system that runs FIRST in system order. Maintains `TouchHistory` (start position, previous position, duration) and resets transient phases after processing:

- `BEGAN` → `MOVED` (finger still touching)
- `ENDED` → `NONE` (slot freed)
- `CANCELLED` → `NONE` (slot freed)

### Utility Functions (kernel side)

Pure functions over InputBuffer + TouchHistory:

- Position/phase queries: `getTouchPosition`, `getTouchPhase`, `isTouchActive`
- Derived: `getTouchVelocity`, `getTouchDelta`, `getTouchDragFromStart`, `getTouchDuration`
- Gesture detection: `isTap`, `isSwipe`, `isLongPress`
- Multi-touch: `getPinchScale`, `getPinchCenter`

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
1. InputSystem          ← process input buffer, update history
2. [user systems]       ← read input, update game state
3. TransformPropagation ← compose world transforms
4. RenderCollection     ← gather visible sprites into RenderBuffer
```

### Frame Loop

Driven by `useFrameCallback` (react-native-reanimated). Each frame:

1. Dynamic entity management (spawn/destroy based on target count)
2. `world.step(dt)` — runs all systems, flushes command buffer
3. `frameVersion.value += 1` — triggers Skia buffer re-evaluation

---

## Contracts

### What the plumbing guarantees to the kernel

- InputBuffer is populated before InputSystem runs (gesture callbacks fire between frames on the UI thread)
- `world.step(dt)` is called exactly once per frame
- `dt` is derived from `useFrameCallback`'s `frame.timeSincePreviousFrame`

### What the kernel guarantees to the plumbing

- RenderBuffer is valid and fully populated after `step()` returns
- `buffer.count` reflects the exact number of visible sprites
- Transform and spriteType arrays are contiguous in `0..count-1`
- No heap allocations during `step()` (zero GC pressure)

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
