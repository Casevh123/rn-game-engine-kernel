# React Native Game Engine

A data-oriented 2D game engine for React Native. Pure TypeScript kernel running on the UI worklet thread, rendering through Skia Atlas.

## What This Is

A high-performance game engine built for React Native from the ground up. Instead of fighting React's reactive model, the engine owns all simulation state on a dedicated worklet context while React serves as a scene declaration layer and Skia handles GPU rendering.

**Three layers:**
- **`@engine/kernel`** — The engine core. Pure TypeScript. SoA memory pools, closure-factory architecture, generational handles, deferred command buffer. Runs in any JS context. 258 tests.
- **`@engine/react-native`** — The bridge. Connects the kernel to Skia rendering, gesture input, and the worklet lifecycle. Currently a skeleton with documented contracts.
- **`apps/demo`** — A stress-test demo. Bouncing sprites with gravity and O(n²) collision at 60fps.

## Monorepo Structure

```
react-native-game-engine/
├── packages/
│   ├── kernel/                 ← @engine/kernel
│   │   ├── src/flat_tree/      ← core source + tests
│   │   ├── SPEC.md             ← kernel specification
│   │   ├── package.json
│   │   └── jest.config.js
│   └── react-native/           ← @engine/react-native
│       ├── src/                ← plumbing source (skeleton)
│       ├── SPEC.md             ← plumbing specification
│       └── package.json
├── apps/
│   └── demo/                   ← Expo demo app
│       ├── GameScreen.tsx      ← main game screen
│       ├── app.json
│       └── package.json
├── docs/                       ← historical decision records
│   ├── a3_audit_report.md      ← worklet compatibility audit
│   └── runtime_target_change.md ← worker → UI thread decision
├── plan.md                     ← project plan & roadmap
├── GETTING_STARTED.md          ← how to build with this engine
└── package.json                ← workspace root
```

## Packages

### @engine/kernel

The engine core. Zero React Native dependencies. Contains:

- **SoA memory pool** — fixed-capacity TypedArray columns for all node data
- **Scene graph** — rooted tree with O(1) attach/detach via doubly-linked sibling lists
- **Generational handles** — `{id, version}` tuples preventing use-after-free
- **Component pools** — dense swap-and-pop arrays with automatic cleanup
- **Transforms** — RSXform layout (sCosθ, sSinθ, tx, ty), trig-free composition
- **Command buffer** — deferred structural mutations, runtime-enforced
- **Systems** — `(world, dt) → void` functions, sequential execution via `step(dt)`

```bash
# Run kernel tests
npm test --workspace=packages/kernel
```

📄 [Kernel Specification](packages/kernel/SPEC.md)

### @engine/react-native

The React Native bridge layer. Connects the kernel to:

- **Rendering** — Skia Atlas consumption of the kernel's RenderBuffer
- **Input** — Gesture.Manual() → InputBuffer writes (planned)
- **Lifecycle** — Engine bootstrap, frame loop, system registration

Currently a skeleton. Reusable abstractions will be extracted from `apps/demo` as patterns stabilize.

📄 [Plumbing Specification](packages/react-native/SPEC.md)

## Demo

The demo app is a stress-test for the engine. Bouncing sprites with gravity, wall bounce, and naive O(n²) collision. Includes a perf overlay and dynamic sprite count controls.

```bash
# Install all workspace dependencies
npm install

# Run the demo
cd apps/demo
npx expo run:ios
```

## Architecture

### Runtime Model

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

The kernel is the sole authority over simulation state. React is a projection — it sends commands but never owns entities. Skia is a consumer — it reads RenderBuffer snapshots but never writes back.

### Closure-Factory Pattern

No classes. No prototypes. Every module is a factory function returning a plain POJO. This is required by worklet serialization — prototype chains are stripped during transfer. Closure-captured state survives.

## Quick Example

```typescript
import { createFlatWorld, createSpritePool, SpriteAtlasLookup } from '@engine/kernel';

// Create a world with capacity for 1024 nodes
const world = createFlatWorld(1024);

// Create a sprite pool
const { pool: spritePool, spriteType } = createSpritePool(world, 256);
world.registerPool(spritePool);

// Spawn a sprite
const node = world.createNode();
world.attach(node, world.root);
const compIdx = spritePool.add(node);
spriteType[compIdx] = 0; // sprite type index
world.setLocalPosition(node, 100, 200);

// Atlas metadata: per-sprite-type dimensions and normalized pivots
const atlas: SpriteAtlasLookup = {
  widths:  new Float32Array([64]),
  heights: new Float32Array([64]),
  pivotXs: new Float32Array([0.5]),
  pivotYs: new Float32Array([0.5]),
};

// Add transform propagation + render collection
world.addSystem(world.createTransformPropagationSystem());
const { system, buffer } = world.createRenderCollectionSystem(spritePool, spriteType, atlas);
world.addSystem(system);

// Tick — systems run, RenderBuffer is populated
world.step(1 / 60);

// buffer.transforms, buffer.spriteTypes, buffer.count are ready for rendering
```

## Documentation

| Document | Description |
|---|---|
| [Kernel Specification](packages/kernel/SPEC.md) | Abstract model, invariants, operation contracts, design decisions |
| [Plumbing Specification](packages/react-native/SPEC.md) | Runtime model, rendering pipeline, input pipeline, lifecycle |
| [Plan](plan.md) | Current status, immediate next features, open decisions |
| [Getting Started](GETTING_STARTED.md) | Step-by-step guide to building with this engine |
| [A3 Audit Report](docs/a3_audit_report.md) | Worklet compatibility verification (historical) |
| [Runtime Target Change](docs/runtime_target_change.md) | Worker → UI thread decision record (historical) |

## Status

**Kernel: built and tested** — scene graph, transforms, render collection with pivot correction, touch input pipeline, 258 tests, verified on-device (500+ sprites at 60fps with gravity and collision in the demo).

**Framework: in progress.** `@engine/react-native` (engine lifecycle, canvas, input bridge) is the current focus. Direction in [plan.md](plan.md); task sequence in [todo.md](todo.md).

## Development

```bash
# Clone and install
git clone <repo-url>
cd react-native-game-engine
npm install

# Run kernel tests
npm test --workspace=packages/kernel

# Run the demo app
cd apps/demo
npx expo run:ios

# Add a new package
mkdir packages/my-package
# Add to root package.json workspaces if needed (packages/* is already included)
```

### Workspace Commands

```bash
npm test --workspace=packages/kernel     # run kernel tests
npm install --workspace=apps/demo        # install demo-specific deps
npm install                              # install everything from root
```
