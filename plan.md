# Plan

> Current state. What's next. What's deferred.
> Last updated: 2026-05-17

---

## Project Structure

This is an npm workspaces monorepo:

```
react-native-game-engine/
├── packages/
│   ├── kernel/          ← @engine/kernel — pure TS engine core
│   └── react-native/    ← @engine/react-native — RN plumbing (skeleton)
├── apps/
│   └── demo/            ← Expo app — stress-test / integration demo
├── docs/                ← Historical decision records
├── GETTING_STARTED.md   ← How to build with this engine
└── README.md
```

- **`@engine/kernel`** — The source of truth. Data-oriented game engine kernel. Pure TypeScript. No React Native dependencies. 203 tests. Contains `'worklet'` directives (no-ops in Jest, functional in RN).
- **`@engine/react-native`** — Bridges kernel to React Native: Skia rendering, gesture input, worklet lifecycle. Currently a skeleton — reusable patterns will be extracted from the demo as they stabilize.
- **`apps/demo`** — Expo app that consumes both packages via workspace dependencies. Bouncing sprite stress test with perf overlay and dynamic sprite count controls.

---

## Runtime Target

The kernel runs on the **UI worklet thread** — the default worklet runtime provided by react-native-reanimated. This is a deliberate change from the original worker worklet design.

| Concern | Technology | Thread |
|---|---|---|
| Engine kernel | `@engine/kernel` (TypeScript) | UI worklet thread |
| Frame loop | `useFrameCallback` (reanimated) | UI worklet thread |
| Rendering | `<Atlas>` + `useRSXformBuffer` (react-native-skia) | UI thread |
| Input | `Gesture.Manual()` (react-native-gesture-handler) | UI thread |
| Scene declaration & UI | React | JS thread |

**Why UI thread, not worker thread:** Synchronous rendering path (no cross-thread serialization), synchronous input (no async snapshot), no transport problem (no SharedValue throughput ceiling, no triple-buffering, no Nitro dependency). Full rationale in [docs/runtime_target_change.md](docs/runtime_target_change.md).

**What this means:** The kernel competes with rendering for UI thread time. Benchmarks show this is acceptable — `world.step(dt)` for 500 sprites with O(n²) collision runs in ~4ms, well within the 16.6ms frame budget.

---

## Current Status

### What's Built

| Component | Status | Where |
|---|---|---|
| SoA memory pool, free-list allocator | ✅ Complete | `packages/kernel/` |
| Scene graph (tree: attach/detach/destroy/reparent) | ✅ Complete | `packages/kernel/` |
| Generational handles (NodeHandle) | ✅ Complete | `packages/kernel/` |
| Component pools (swap-and-pop, registry) | ✅ Complete | `packages/kernel/` |
| Command buffer (deferred mutations) | ✅ Complete | `packages/kernel/` |
| RSXform transforms (local + world) | ✅ Complete | `packages/kernel/` |
| Transform propagation system | ✅ Complete | `packages/kernel/` |
| SpritePool (ComponentPool wrapper) | ✅ Complete | `packages/kernel/` |
| Render collection system (gather operation) | ✅ Complete | `packages/kernel/` |
| Worklet compatibility ('worklet' directives) | ✅ Verified | `packages/kernel/` |
| Demo: Skia Atlas rendering | ✅ Working | `apps/demo/` |
| Demo: gravity + O(n²) collision | ✅ Working | `apps/demo/` |
| Demo: perf overlay + dynamic sprite count | ✅ Working | `apps/demo/` |
| Monorepo (npm workspaces) | ✅ Complete | Root |

### What's Proven

- Kernel factories instantiate and tick correctly in worklet context (A3 audit: 18/18)
- 203 kernel tests pass in Jest (worklet directives are no-ops)
- 500 sprites at 60fps with gravity + collision on iPhone hardware
- Workspace dependency resolution works with Reanimated babel plugin

---

## Immediate Next

The next two features to implement, in order.

### 1. Input System

**Goal:** Touch input flows from gesture callbacks to the kernel, processed as state each frame.

**Kernel side** (pure, testable):
- `InputBuffer` — TypedArray-backed world-level singleton (touchX/Y, phase, id per slot)
- `InputSystem` — engine system: updates `TouchHistory`, resets transient phases
- Utility functions — pure queries: velocity, delta, tap/swipe/longpress detection

**Plumbing side** (React Native):
- `Gesture.Manual()` wraps `<Canvas>` — writes directly to InputBuffer on UI thread
- Same-thread, synchronous, zero-latency

**Design:** Settled. See [input system architecture](packages/react-native/SPEC.md#input-pipeline-planned) for the full contract.

### 2. Sprite Pivot Correction

**Goal:** Sprites render centered at their world position instead of from the top-left corner.

**What's needed:**
- `SpriteAtlasLookup` — TypedArray-backed map from sprite type to `{ width, height, pivotX, pivotY }`
- Pivot offset applied during render collection (kernel-side, in the gather operation)
- Atlas metadata passed from JS side to worklet thread

**Why this matters:** Without pivot correction, sprites at position (100, 100) have their top-left corner at that point. With correction, their center (or custom pivot) is at that point. This is fundamental for collision, input hit-testing, and visual accuracy.

---

## Open Architecture Decisions

| Decision | Context | When Needed |
|---|---|---|
| Camera: dedicated node vs storage column vs render-time offset | Affects render collection — camera inverse transform applied to all sprites | Before camera implementation |
| Z-ordering strategy: tree-order vs z-index component vs y-sort | Affects render collection output ordering | Before layered rendering |
| Particle path: full entities vs dedicated lightweight pool | Full entities carry overhead (transforms, tree structure). Particles may warrant a dedicated system | Before particle effects |
| React scene API: JSX reconciler vs imperative commands | How React declares entities. Affects developer ergonomics | When the engine API stabilizes |
| Fixed vs variable timestep | Variable (current) is simpler. Fixed is more deterministic | When physics demands reproducibility |

### Resolved Decisions (no longer open)

| Decision | Resolution |
|---|---|
| Runtime target | UI worklet thread (not worker worklet) |
| Kernel packaging | Monorepo workspace (not source copy, not npm publish) |
| Render buffer format | Parallel Float32Array (transforms) + Int32Array (spriteTypes) |
| Transport mechanism | Same-thread globalThis (no SharedValue bridge, no Nitro) |
| Worklet directives | Permanent in kernel source (no-ops in Jest) |
| Component pool design | Closure-factory with swap callback (not class inheritance) |

---

## Future Features

Not roadmapped with version numbers. Listed by category for reference.

### Kernel Features (pure, no RN dependency)
- **Animation system** — AnimationPool + AnimationSystem advancing sprite frames
- **Camera system** — camera node, inverse transform in render collection
- **Z-ordering** — draw order control in render buffer
- **Physics** — velocity integration, collision detection, spatial index
- **Event output buffer** — discrete events emitted per frame (sound triggers, lifecycle)

### Plumbing Features (React Native)
- **`useEngine` hook** — reusable bootstrap pattern
- **`<EngineCanvas>` component** — Canvas + Atlas + buffer management
- **`useInputBridge` hook** — Gesture.Manual() → InputBuffer wiring
- **`<PerfOverlay>` component** — extractable from demo
- **Scene management** — load/unload/transition

### Production Features (v-far)
- Non-sprite rendering (circles, rects, paths)
- Text rendering
- Sound (kernel emits events, played on native thread)
- Asset pipeline (spritesheet definitions, animation sequences)
- React reconciler (JSX → kernel commands)
