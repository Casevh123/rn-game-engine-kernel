# React Native Game Engine

A data-oriented 2D game engine kernel for React Native. Pure TypeScript — runs on a dedicated background thread via `createWorkletRuntime`, renders through react-native-skia.

## What this is

React's lifecycle is reactive. Games are imperative. This engine bridges that gap with a high-performance kernel that owns all simulation state on its own thread, while React serves as a declarative scene API and Skia handles GPU rendering.

The kernel is developed and tested in isolation — no React Native dependency. Its invariants are proven by ~196 tests and hold regardless of runtime environment. The kernel IS the runtime, not a spec for a future port.

## Architecture

- **SoA memory pool** — fixed-capacity typed array columns for all node data
- **Generational indices** — `(id, version)` references prevent use-after-free on slot reuse
- **Doubly-linked sibling lists** — O(1) attach/detach
- **Dense component pools** — swap-and-pop removal, one pool per component type
- **Transforms** — RSXform layout (sCosθ, sSinθ, tx, ty) per node, local + world. Trig-free composition via pre-order tree walk
- **Systems** — `(world, dt) → void` functions that read/write pool data
- **Command buffer** — deferred structural mutations, flushed after all systems run
- **Frame loop** — `World.step(dt)` runs systems sequentially then flushes commands
- **Facade pattern** — OOP ergonomics (`node.enabled = false`) over DOD storage

## Runtime Model

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   React (JS Thread) │     │  Kernel (Worklet     │     │  Skia (UI Thread)   │
│                     │────▶│  Background Thread)  │────▶│                     │
│  Scene declaration  │     │  World.step(dt)      │     │  <Atlas> + drawAtlas│
│  User input events  │     │  SoA pools           │     │  useRSXformBuffer   │
│  Command source     │     │  Transform propagate │     │  useFrameCallback   │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

The kernel is the sole authority over simulation state. React is a projection (sends commands, never owns state). The renderer is a consumer (reads snapshots, never writes back).

## Documentation

- [`spec.md`](spec.md) — Abstract model, invariants, operation contracts, design decisions with rationale
- [`plan.md`](plan.md) — Version roadmap (v0–v2), kernel work remaining, open architecture decisions

Tests are the executable spec. Docs capture what tests can't: the model, the invariants, and *why*.

## Status

**Kernel functionally complete** — tree operations, component pools, execution model, and transform propagation are implemented and tested (~196 tests). Currently filling out remaining kernel-side features (render collection, sprites, camera, input state, animations) before wiring the worklet runtime integration (v0).

```
npm test
```
