# Plan

> Current state. What's next. What's deferred.
> Last updated: 2026-05-12

---

## Done

- **Tree**: create, attach, detach, destroy (iterative post-order subtree), reparent (cycle detection)
- **Storage**: SoA allocator, free-list, generational indices, doubly-linked siblings
- **Components**: Dense pools with swap callback, swap-and-pop, pool registry, automatic cleanup on destroy
- **Architecture**: Closure-factory pattern — all modules are factory functions returning plain POJOs (no classes, no prototypes). Fully serializable across worklet thread boundaries
- **Handles**: `NodeHandle` tuples `{id, version}` — world-agnostic, value-compared via `refEquals()`
- **Execution model**: System type, CommandBuffer (deferred structural mutations), `world.step(dt)`
- **Proof**: Movement system (velocity + position pools + movementSystem) demonstrating end-to-end frame loop
- **Transforms**: RSXform storage columns (4 floats per transform: sCosθ, sSinθ, tx, ty), local + world per node, transform propagation system (iterative pre-order tree walk), disabled subtree skipping, convenience accessors
- **Transform proof**: Movement system writes localTx/localTy → propagation computes world transforms → child tracks parent motion across frames. Reparent, destroy, and disable/re-enable all verified end-to-end
- **Phase A (worklet compatibility)**: Complete. A1 (TypedArray primitives ✅), A2 (class serialization ❌ → motivated factory migration), A3 (full kernel on worklet runtime ✅ 18/18). Kernel instantiates, ticks, propagates transforms, and defers commands correctly on `createWorkletRuntime`
- **Tests**: 182 tests across storage, world, destroy/reparent, component pools, command buffer, step, transforms, and integration
- **Axiom 9 enforcement**: Runtime guards on `destroy()`, `attach()`, `detach()`, `reparent()` — throw during `step()`
- **Crash recovery**: System throw clears command buffer (atomic frame semantics), world remains usable

---

## Runtime Target

This TypeScript kernel IS the runtime — not a behavioral specification for a future C++ port. It runs on a dedicated background JS thread via `createWorkletRuntime` (react-native-reanimated).

| Concern | Thread | Technology |
|---|---|---|
| Game kernel (world.step, SoA pools, systems) | Background worklet thread | TypeScript, `createWorkletRuntime` |
| Rendering | UI thread (main thread) | react-native-skia `<Atlas>`, `useRSXformBuffer` |
| Scene declaration & UI | JS thread | React, custom reconciler (v1.3+) |
| Data transport (kernel → renderer) | Cross-thread | SharedValue (v0) → native buffer via Nitro (v1+) |
| Input transport (UI → kernel) | Cross-thread | SharedValue snapshot, read per frame |

**Authority model**: The kernel is the sole owner of simulation state. React is a projection — it sends commands but never owns entities, transforms, or components at runtime. The renderer is a consumer — it reads snapshots but never writes back.

**Kernel packaging**: The kernel source is copied into the app repo. `'worklet'` directives are added at the integration boundary (not in this repo). The Reanimated Babel plugin processes directives in app source, not `node_modules` — so publishing as a compiled npm package would NOT enable worklet serialization. Source copying is the correct strategy for now.

---

## Version Roadmap

### v0 — Proof of Concept

Kernel on a worklet thread. Sprites on screen. SharedValue bridge. React has no runtime authority — scene setup is hardcoded in the kernel initializer.

**v0 proves:**
- Kernel factories instantiate inside `createWorkletRuntime` ✅ (proven by A3)
- `world.step(dt)` ticks on a background thread at a stable rate
- Render snapshot crosses the thread boundary via SharedValue
- `useRSXformBuffer` consumes the snapshot and `<Atlas>` draws sprites

**Kernel prerequisites (buildable in this repo):**
- SpritePool component
- Render collection system (engine system, runs after transform propagation)
- Render buffer specification (output format of render collection)

**Resolved questions:**
- ~~Kernel bundling: how do kernel classes get into the worklet initializer?~~ → Closure-factory POJOs with `'worklet'` directives. Babel plugin follows capture chain. Proven in A3
- ~~Game loop driver: what timing primitives exist in `createWorkletRuntime`?~~ → `setInterval` and `setTimeout` confirmed available (A1). `performance.now()` available for timing
- SharedValue throughput: how many entities before frame drops? → **Phase B will determine this**

---

### v1 — Native Buffer Transport

Replace SharedValue bridge with a Nitro native module owning a triple-buffered C++ render packet. **This is a critical-path dependency** — if the engine can't sustain its target entity count, it's blocked.

**v1 delivers:**
- Nitro HybridObject with pre-allocated float buffers
- Atomic index swap (lock-free triple buffering)
- Game thread writes to back buffer, UI thread reads front buffer
- Zero per-frame allocation, zero GC pressure

**Open problems:**
- Nitro module setup (C++, CMake, Xcode platform glue)
- Exact render packet struct layout
- Thread safety validation (no tearing, no stale reads)

---

### v1.1 — React Scene API

React can declare the scene. The kernel processes declarations into its scene graph.

**The core problem:** React's reconciler assumes it owns the tree. The kernel owns the tree. React must be a command source, not a state owner. React's diffs are against its own virtual tree — it doesn't see kernel-side mutations (physics moving an entity, a script destroying an entity).

**v1.1 delivers:**
- Command channel: React → kernel (create, destroy, attach, set properties)
- Entity handle mapping: React can refer to kernel entities after creation
- Property ownership contract: which properties React controls vs kernel controls

**Open problems:**
- Handle mapping: string names? returned IDs? UUID registry?
- Stale handle: if the kernel destroys an entity, React still holds a handle — how is React notified?
- One-way vs two-way: does React ever need to read kernel state?

---

### v1.2 — Input

Without input this is a simulation engine, not a game engine.

**The input model:** Input events fire on the UI thread (touch, gesture). The kernel reads input STATE each frame, not individual events. Each frame, the kernel samples a pre-written input snapshot.

**v1.2 delivers:**
- Input state structure (touch positions, active touches, button states)
- SharedValue written by gesture handler on UI thread, read by kernel per frame
- Input system (engine system) that copies input state into kernel-accessible storage

**Open problems:**
- Gesture library: react-native-gesture-handler vs raw touch events?
- Input abstraction: raw touches vs virtual buttons/joysticks?
- Input latency: one frame behind (kernel reads previous frame's input)

---

### v1.3 — React Reconciler & Production API (First Shippable Version)

The full developer-facing API. Production-ready core. The focus of this version is the API, not just the reconciler.

**v1.3 delivers:**
- Custom React reconciler: JSX maps to kernel operations
- Per-node scripts with lifecycle hooks (`onReady`, `onUpdate`, `onDestroy`)
- Engine system auto-registration (transforms, render collection are automatic)
- Builder/spawn API for ergonomic entity creation
- Comprehensive documentation

---

### v2 — Feature Complete

Full horizontal feature set. Production documentation. The complete game engine.

**v2 horizontal features:**
- Animations (kernel system: AnimationPool + AnimationSystem advancing sprite frames)
- Physics (kernel system: velocity integration, collision detection, spatial data structure)
- Particles (dedicated lightweight pool, separate from entity system)
- Sound (kernel emits sound events via output channel, played on JS/native thread)
- Events / messaging bus (collision events, lifecycle events, custom events)
- Lifecycle hooks (onReady, onUpdate, onDestroy — may move to v1.3)
- Camera / viewport (camera node, screen-space transform in render collection)
- Z-ordering / draw layers (z-index component or tree-order, sorted render output)
- Non-sprite rendering (circles, rects, paths — type-tagged render buffer, imperative Skia canvas)
- Text rendering
- Scene management (load/unload/transition)
- Asset pipeline (sprite sheet definitions, animation sequence definitions)

---

## Kernel Work Remaining (solvable in this repo now)

These features can be designed, implemented, and tested in this repo with no React Native dependency. The kernel's mathematical guarantees hold regardless of runtime.

| Feature | What it is | Boundary-dependent? |
|---|---|---|
| SpritePool | `createComponentPool` + spriteType data array | No |
| Render collection system | Engine system: iterates renderable pools + world transforms, writes render buffer | Output FORMAT is (will need validation at v0) |
| Camera transform | Inverse RSXform composition: `screen = inv(camera) × entity` | No |
| Z-index component | Storage column or pool for draw ordering | No |
| Animation component + system | Pool (anim state) + system (advance frames, write spriteType) | No |
| Input state structure | Data layout the kernel reads each frame (positions, buttons) | FORMAT is (will need validation at v0) |
| Fixed timestep loop | Accumulator pattern, testable with fake time | No |
| Event output buffer | Discrete events emitted by kernel per frame (sound, lifecycle) | FORMAT is (will need validation at v0) |

Items marked "boundary-dependent" means the kernel-side logic is correct regardless, but the exact data layout may need adjustment when the consumer (Skia/SharedValue/Nitro) is wired up. Design these with a clean interface so the format is swappable.

---

## Open Architecture Decisions

| Decision | Affects | When needed |
|---|---|---|
| Render buffer type-tagging: sprite-only vs extensible (circles, rects) | Render collection system, UI bridge | Before render collection impl |
| Z-ordering strategy: tree-order vs z-index component vs y-sort | Render collection, SpritePool | Before render collection impl |
| Camera: dedicated node vs storage column vs render-time offset | Render collection system | Before render collection impl |
| Entity handle mapping: names vs IDs vs UUIDs | React ↔ kernel command channel | Before v1.1 |
| Particle path: full entities vs dedicated lightweight pool | Particle system, render collection | Before v2 |
| Fixed vs variable timestep | Game loop driver | Before v0 |
