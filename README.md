# React Native Game Engine — Prototype

A data-oriented 2D game engine kernel for React Native, written from scratch in pure TypeScript. Simulation runs on the UI worklet thread; rendering goes through Skia's `drawAtlas`.

> ## Project status
>
> **This is a working engine kernel with a stress-test demo — not yet a usable framework.**
>
> - **`@engine/kernel` is substantial and tested**: scene graph, SoA memory pools, generational handles, transform propagation, render collection, touch input pipeline. 258 tests across 13 suites, all passing. Verified on-device via the demo.
> - **`@engine/react-native` (the framework layer) is in progress**: today it only re-exports the kernel. The public API — `useEngine`, `<EngineCanvas>`, the input bridge — is designed ([SPEC](packages/react-native/SPEC.md)) but not yet implemented. The demo wires Skia and the frame loop directly; those are the patterns the framework layer will extract.
>
> Direction lives in [plan.md](plan.md); the ordered task sequence in [todo.md](todo.md).

## Demo

<!-- ── DEMO VIDEO ──
To embed the clip: edit this file in the GitHub web editor and drag docs/demo.mp4
(kept locally, untracked) onto the blank line below. GitHub uploads it to its CDN
and inserts a user-attachments URL that renders as an inline player — the video
never enters repo history. Delete this comment afterwards.
The recordings live untracked at docs/demo.mp4 (compressed) and docs/demo.gif (original). -->





**What the clip shows:** ~200 sprites at ~150 fps in the **iOS Simulator** (iPhone 17 Pro Max, iOS 26.5) hosted on an M2 MacBook Air (2022, 16 GB) — so those numbers reflect Mac hardware with an uncapped frame rate, not phone performance. On a physical device the engine has held 500+ sprites at 60 fps, measured informally via the overlay; a proper benchmark suite is on the roadmap.

The demo is a stress test, not a game: bouncing sprites with gravity, wall bounce, and naive O(n²) collision, plus touch input — fingers act as physical colliders you can bat sprites around with. A live perf overlay reports frame rate and `step()` time, with buttons to add/remove sprites at runtime.

```bash
npm install
cd apps/demo
npx expo run:ios
```

## Why this exists

React Native is a hostile environment for a game loop: React's reactive model, the JS-thread/UI-thread split, and worklet serialization all fight you. This project's answer is to invert the usual architecture — the engine owns all simulation state in a worklet context on the UI thread, React is only a declaration/projection layer, and Skia consumes flat render buffers without ever touching engine state.

```
┌──────────────────────┐
│   JS Thread (React)  │
│  Scene declaration   │──── SharedValue / runOnJS ────┐
│  State management    │                               │
└──────────────────────┘                               │
                                                       ▼
┌─────────────────────────────────────────────────────────┐
│                    UI Thread (Worklet)                   │
│                                                         │
│  ┌─────────────┐    ┌───────────────┐    ┌───────────┐ │
│  │ Gesture     │───▶│ Engine Kernel │───▶│ Skia      │ │
│  │ Callbacks   │    │ world.step()  │    │ <Atlas>   │ │
│  │ (input)     │    │ SoA pools     │    │ drawAtlas │ │
│  └─────────────┘    └───────────────┘    └───────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Engineering highlights

The kernel is where the interesting work is:

- **Structure-of-arrays storage** — all node data lives in fixed-capacity TypedArray columns (no per-entity objects), designed for cache-friendly iteration on a phone.
- **Generational handles** — entity references are `{id, version}` tuples; stale handles are detected instead of silently reading recycled slots.
- **Invariant-driven design** — the `worldEnabled` flag (enabled ∧ all ancestors enabled ∧ root-reachable) is specified as a transition matrix ([NewWorldInvariant.md](packages/kernel/working_docs/NewWorldInvariant.md)) and enforced across every mutation path.
- **Deferred command buffer** — structural mutations (destroy, attach, detach) are illegal mid-`step()` and enforced at runtime; systems queue them instead.
- **Closure-factory architecture, no classes** — worklet serialization strips prototype chains, so every module is a factory returning a plain object over closure state. This constraint shaped the entire codebase.
- **Two-buffer input pipeline** — raw touch events accumulate in a ring buffer, cooked into per-frame `TouchState` by begin/end-frame systems, per a written contract ([TouchSpec.md](packages/kernel/working_docs/TouchSpec.md)).
- **Tested at the contract level** — 258 tests targeting the specified invariants (handle staleness, swap-and-pop integrity, enable-state transitions, command-buffer guards), not just happy paths.

## Authorship and AI use

This repo is explicit about what was hand-written and what was AI-generated, so you can point your attention at the part that demonstrates engineering:

- **The kernel and its 258 tests (`packages/kernel/src/`) are almost entirely hand-written.** That is the substance of this project — the SoA storage, scene graph, generational handles, invariant enforcement, component pools, transform math, input pipeline, and the contract-level test suite. AI contributed a few mechanical passes (e.g. adding `'worklet'` directives across the input layer) and was used as a sounding board when working out the specs.
- **The working docs (`packages/kernel/working_docs/`) are hand-written** — author-owned design contracts like the worldEnabled invariant matrix and the touch input spec.
- **The demo app, the monorepo scaffolding, and the rest of the documentation (this README, the SPEC files, GETTING_STARTED) are AI-generated**, produced under the author's direction and review.

If you are evaluating the author's work: read the kernel source and its tests.

## Honest limitations

Known gaps, tracked in [todo.md](todo.md):

- **Component pools put correctness on the user.** Swap-and-pop callbacks must swap *every* per-component array; forgetting one silently desyncs data. The planned fix (pools own their columns and generate the swap) is designed but not built.
- **Mutation guards are incomplete.** `pool.add/remove` and `createNode()` are not yet blocked mid-`step()`.
- **No camera, no z-ordering.** Draw order is currently undefined (pool order is scrambled by swap-and-pop by design).
- **The demo bypasses the framework layer** — it bootstraps onto `globalThis` inside the frame callback, so Fast Refresh can orphan engine instances. Fixed by the `useEngine` lifecycle work.
- **Perf numbers are informal.** The overlay measures real `step()` time on-device, but there is no benchmark suite or comparison against naive approaches yet.

## Monorepo structure

```
react-native-game-engine/
├── packages/
│   ├── kernel/                 ← @engine/kernel — the engine core (pure TS, no RN deps)
│   │   ├── src/flat_tree/      ← scene graph, pools, transforms, systems + tests
│   │   ├── src/                ← touch input pipeline
│   │   └── SPEC.md             ← kernel specification
│   └── react-native/           ← @engine/react-native — framework layer (in progress)
│       ├── src/index.ts        ← currently re-exports the kernel; API designed in SPEC.md
│       └── SPEC.md             ← target API (ahead of implementation)
├── apps/
│   └── demo/                   ← Expo stress-test demo
├── docs/                       ← decision records (worklet audit, runtime-target change)
├── plan.md                     ← direction & rationale
└── todo.md                     ← ordered task sequence
```

## Quick example (kernel)

The kernel runs in any JS context — this works in plain Node/Jest:

```typescript
import { createFlatWorld, createComponentPool, SpriteAtlasLookup } from '@engine/kernel';

// World with capacity for 1024 nodes
const world = createFlatWorld(1024);

// A component pool with one data column. The swap callback must cover
// EVERY per-component array you maintain (see Honest limitations).
const spriteType = new Int32Array(256);
const spritePool = createComponentPool(world, 256, (a, b) => {
  const tmp = spriteType[a]; spriteType[a] = spriteType[b]; spriteType[b] = tmp;
});
world.registerPool(spritePool);

// Spawn a sprite
const node = world.createNode();
world.attach(node, world.root);
const compIdx = spritePool.add(node);
spriteType[compIdx] = 0;
world.setLocalPosition(node, 100, 200);

// Atlas metadata: per-sprite-type dimensions and normalized pivots
const atlas: SpriteAtlasLookup = {
  widths:  new Float32Array([64]),
  heights: new Float32Array([64]),
  pivotXs: new Float32Array([0.5]),
  pivotYs: new Float32Array([0.5]),
};

// Transform propagation + render collection
world.addSystem(world.createTransformPropagationSystem());
const { system, buffer } = world.createRenderCollectionSystem(spritePool, spriteType, atlas);
world.addSystem(system);

// Tick — systems run, RenderBuffer is populated
world.step(1 / 60);
// buffer.transforms, buffer.spriteTypes, buffer.count are ready for Skia's drawAtlas
```

## Documentation

| Document | Description |
|---|---|
| [Kernel Specification](packages/kernel/SPEC.md) | Abstract model, invariants, operation contracts, design decisions |
| [Framework Specification](packages/react-native/SPEC.md) | Target API for `@engine/react-native` — ahead of implementation |
| [Plan](plan.md) | Direction, rationale, open decisions |
| [Todo](todo.md) | Ordered task sequence toward a usable framework |
| [Getting Started](GETTING_STARTED.md) | Building against the kernel today |
| [A3 Audit Report](docs/a3_audit_report.md) | Worklet compatibility verification (historical) |
| [Runtime Target Change](docs/runtime_target_change.md) | Worker-thread → UI-thread decision record (historical) |

## Development

```bash
git clone <repo-url>
cd react-native-game-engine
npm install

npm test --workspace=packages/kernel     # run the 258 kernel tests
cd apps/demo && npx expo run:ios         # run the demo
```
