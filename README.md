# React Native Game Engine

A data-oriented 2D game engine kernel for React Native. Pure TypeScript — runs on a dedicated background thread via `createWorkletRuntime`, renders through react-native-skia.

## What this is

React's lifecycle is reactive. Games are imperative. This engine bridges that gap with a high-performance kernel that owns all simulation state on its own thread, while React serves as a declarative scene API and Skia handles GPU rendering.

The kernel is developed and tested in isolation — no React Native dependency. Its invariants are proven by 182 tests and hold regardless of runtime environment. The kernel IS the runtime, not a spec for a future port.

## Architecture

- **Closure-factory functions** — no classes, no prototypes. Every module is a factory returning a plain POJO. Fully serializable across worklet thread boundaries
- **SoA memory pool** — fixed-capacity typed array columns for all node data
- **Generational indices** — `(id, version)` handle tuples (`NodeHandle`) prevent use-after-free on slot reuse
- **Doubly-linked sibling lists** — O(1) attach/detach
- **Dense component pools** — swap-and-pop removal, one pool per component type, user-provided swap callback
- **Transforms** — RSXform layout (sCosθ, sSinθ, tx, ty) per node, local + world. Trig-free composition via pre-order tree walk
- **Systems** — `(world, dt) → void` functions that read/write pool data
- **Command buffer** — deferred structural mutations, flushed after all systems run
- **Frame loop** — `world.step(dt)` runs systems sequentially then flushes commands

## Runtime Model

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   React (JS Thread) │     │  Kernel (Worklet     │     │  Skia (UI Thread)   │
│                     │────▶│  Background Thread)  │────▶│                     │
│  Scene declaration  │     │  world.step(dt)      │     │  <Atlas> + drawAtlas│
│  User input events  │     │  SoA pools           │     │  useRSXformBuffer   │
│  Command source     │     │  Transform propagate │     │  useFrameCallback   │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

The kernel is the sole authority over simulation state. React is a projection (sends commands, never owns state). The renderer is a consumer (reads snapshots, never writes back).

## API

```typescript
// Create a world with capacity for 1024 nodes
const world = createFlatWorld(1024);

// Create nodes and build the tree
const player = world.createNode();
world.attach(player, world.root);

// Create a component pool with user-owned data
const vx = new Float32Array(256);
const vy = new Float32Array(256);
const pool = createComponentPool(world, 256, (a, b) => {
    let tmp = vx[a]; vx[a] = vx[b]; vx[b] = tmp;
    tmp = vy[a]; vy[a] = vy[b]; vy[b] = tmp;
});
world.registerPool(pool);

// Add a system
world.addSystem((world, dt) => {
    for (let i = 0; i < pool.count; i++) {
        const handle = pool.getNodeHandle(i);
        const t = world.getLocalTransform(handle);
        world.setLocalPosition(handle, t.tx + vx[i] * dt, t.ty + vy[i] * dt);
    }
});

// Add transform propagation
world.addSystem(world.createTransformPropagationSystem());

// Tick
world.step(1 / 60);
```

## Documentation

- [`spec.md`](spec.md) — Abstract model, invariants, operation contracts, design decisions with rationale
- [`plan.md`](plan.md) — Version roadmap (v0–v2), kernel work remaining, open architecture decisions
- [`v0execution-todo.md`](v0execution-todo.md) — Ordered execution steps from current state to sprites on screen

Tests are the executable spec. Docs capture what tests can't: the model, the invariants, and *why*.

## Status

**Phase A complete.** The kernel is fully worklet-compatible — 182 tests pass in Jest, and the complete factory chain (createFlatWorld → createFlatTreeStorage → createCommandBuffer → createComponentPool) has been verified on a dedicated worklet runtime via `createWorkletRuntime` (A3 audit: 18/18 checks passed). Next: Phase B (rendering consumption model).

```
npm test
```
