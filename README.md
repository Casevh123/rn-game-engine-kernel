# React Native Game Engine — Prototype

A data-oriented game engine kernel for React Native. Pure TypeScript behavioral specification — no platform dependencies.

## What this is

React's lifecycle is reactive. Games are imperative. This repo bridges that gap by building the game logic layer first: a scene graph, component system, and update loop, all testable without a device.

The architecture uses struct-of-arrays (SoA) layout, generational indices, and dense component pools — designed for cache-friendly simulation and future compatibility with SharedArrayBuffer / native C++ backends.

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

## Documentation

- [`spec.md`](spec.md) — Abstract model, invariants, operation contracts, design decisions with rationale
- [`plan.md`](plan.md) — Current state, what's next, what's deferred

Tests are the executable spec. Docs capture what tests can't: the model, the invariants, and *why*.

## Status

**Kernel functionally complete** — tree operations, component pools, execution model, and transform propagation are implemented and tested (~196 tests). Next milestone: user-facing API design (script hooks, React reconciler, engine system auto-registration).

```
npm test
```

