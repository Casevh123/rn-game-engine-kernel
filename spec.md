# Engine Specification

> The abstract model for a data-oriented game engine kernel. Tests are the executable spec. This document captures what tests cannot: the model, the invariants, and why decisions were made.
>
> This spec describes the kernel that runs on a dedicated worklet thread via `createWorkletRuntime` (react-native-reanimated). The invariants defined here are runtime-agnostic — they hold in tests, in a worklet, or in any future backend. Cross-thread boundaries (kernel ↔ renderer, kernel ↔ React) are documented in [`plan.md`](plan.md).

---

## Abstract Model

### Entities (Nodes)

An entity is an integer slot in a fixed-capacity memory pool. Slots are backed by parallel typed array columns (struct-of-arrays). Each slot carries:

- **Structural links** (`Int32Array`): parent, firstChild, nextSibling, prevSibling
- **Lifecycle state** (`Int32Array`): alive, enabled, worldEnabled, version
- **Allocator state** (`Int32Array`): freeNext (free-list linkage, closure-scoped)
- **Local transform** (`Float32Array`): localA, localB, localTx, localTy
- **World transform** (`Float32Array`): worldA, worldB, worldTx, worldTy

Entities form a **rooted tree**. Slot 0 is the root — always alive, never freed. Remaining slots begin on a singly-linked free list. Allocation pops from the head; freeing pushes back (LIFO reuse with version bump).

### References (NodeHandle)

A `NodeHandle` is a plain `{ readonly id: number; readonly version: number }` tuple — a **generational handle**. The version prevents use-after-free: if a slot has been freed and reallocated, old references are rejected because their version no longer matches.

Handles are world-agnostic value types. Equality is checked via `refEquals(a, b)` which compares both `id` and `version`. Handles carry no methods and no world reference — they are pure data.

### The Tree

Children are stored as a **doubly-linked sibling list** per parent. Structural mutations are O(1):

- **Attach**: head-insert into parent's child list
- **Detach**: linked-list splice
- **Destroy**: iterative post-order (two-stack) — children first, then unlink from parent, clean component pools, free slot
- **Reparent**: inline unlink + head-insert (not detach→attach, which would reject the parentless intermediate state)

### Components

Components are **data, not behavior**. No `update()` methods. No lifecycle hooks.

Each component type has a dedicated **ComponentPool** created via `createComponentPool(world, capacity, swapFn)` — a dense array where live components occupy indices `0..count-1`. Removal uses **swap-and-pop**: the last entry fills the gap, maintaining density without holes.

The `swapFn` callback is provided by the user to swap their own data arrays during removal. This replaces the former abstract class inheritance pattern — users own their TypedArrays directly, and the pool handles only index bookkeeping.

Each pool maintains three mappings:

- `nodeToComponent[nodeId]` → component index (O(1) "has?" and "where?")
- `componentToNode[compId]` → node id (reverse mapping for iteration)
- `componentToVersion[compId]` → generation (stale entry detection)

One component per type per node. Pools are registered with the world for automatic cleanup on destroy.

### Transforms

Every node has a **local transform** (relative to parent) and a **world transform** (relative to world origin). Both are storage columns, not components — transforms are fundamental to what a node is, not optional data.

Transforms use **RSXform layout**: 4 floats per transform `(a, b, tx, ty)` where `a = scale * cos(θ)`, `b = scale * sin(θ)`. Identity is `(1, 0, 0, 0)`. This representation supports uniform scale + rotation + translation (no shear).

**Composition** (`WorldChild = WorldParent × LocalChild`):
```
result.a  = p.a * c.a  - p.b * c.b
result.b  = p.a * c.b  + p.b * c.a
result.tx = p.a * c.tx - p.b * c.ty + p.tx
result.ty = p.b * c.tx + p.a * c.ty + p.ty
```

Composition is pure arithmetic — no trigonometry. Trig only appears when a system explicitly sets a rotation angle (uncommon mutation, not a per-frame cost).

World transforms are computed by a **transform propagation system** — an iterative pre-order tree walk that composes `WorldChild = WorldParent × LocalChild` top-down. Disabled nodes (enabled = 0) and their entire subtrees are skipped; their world transforms retain their last computed value.

The propagation system is an **engine-level system** — created by `world.createTransformPropagationSystem()`, which closes over private storage. The user registers it via `addSystem()`. (In a future user-facing API layer, it will become automatic.)

**Write authority**: systems write to local transforms; propagation computes world transforms. `setWorldTransform` is intentionally absent from the public API.

### Systems

A system is a function `(world, dt) → void` that reads and writes component pool data. Systems are **behavior without data** — the counterpart to components, which are **data without behavior**.

Systems are registered on the world via `addSystem()` and run sequentially in registration order during `step(dt)`. Systems may iterate pools (flat, cache-friendly) or walk the tree (for hierarchy-dependent operations like transform propagation). The system contract constrains **mutation rules**, not **iteration strategy**.

### Command Buffer

Structural mutations (destroy, attach, detach, reparent) must not occur during system execution — they would invalidate pool indices mid-iteration (swap-and-pop changes order) and corrupt tree structure mid-traversal. This is **enforced at runtime**: calling `destroy()`, `attach()`, `detach()`, or `reparent()` directly on the world during `step()` throws. Systems must enqueue mutations into a **CommandBuffer** that executes them after all systems have run.

`createNode()` is immediate (free-list pop, no pool impact). Component `pool.add()` / `pool.remove()` are immediate but must not target a pool currently being iterated by the calling system.

### Frame Loop

`world.step(dt)` is the frame:

1. Run all registered systems in order, each receiving `(world, dt)`
2. Flush the command buffer (execute all deferred mutations in FIFO order)

Step is non-reentrant. If a system throws, the command buffer is **cleared** (partial-frame commands are unsafe to commit — they may have causal dependencies on commands that never ran). The stepping guard is cleared and the error is re-thrown so the world remains usable for subsequent frames.

### World

The world owns the memory pool, the pool registry, the system list, the command buffer, and all mutation authority. Every operation goes through the world. Every operation validates liveness and version before proceeding.

The world is created via `createFlatWorld(capacity)` — a closure-factory that returns a plain object implementing the `FlatWorld` interface. All private state (storage, pools, systems, stepping flag) is captured in closures. The returned object is a POJO with no prototype chain, making it fully serializable across worklet thread boundaries.

---

## Architecture: Closure-Factory Pattern

The entire kernel uses **closure-factory functions** instead of classes. Every module exports a factory that returns a plain POJO conforming to an interface:

| Factory | Returns | Captures |
|---|---|---|
| `createFlatTreeStorage(capacity)` | `FlatTreeStorage` | TypedArrays, freeHead, allocator state |
| `createCommandBuffer(world)` | `CommandBuffer` | command queue, world reference |
| `createComponentPool(world, cap, swapFn)` | `ComponentPool` | mapping arrays, count, world reference, user swap callback |
| `createSpritePool(world, capacity)` | `SpritePoolResult` | spriteType `Int32Array`, component pool |
| `createFlatWorld(capacity)` | `FlatWorld` | storage, pools set, systems list, stepping flag |

**Why factories instead of classes:** The kernel runs on a worklet runtime (`createWorkletRuntime`). Worklet serialization strips prototype chains — class methods become undefined on the receiving thread. Closure-factory POJOs serialize cleanly because their "methods" are own properties (function references), not inherited from a prototype.

This was proven empirically:
- **A2 audit**: Classes fail — methods stripped during serialization
- **A3 audit**: Factory POJOs pass — 18/18 checks on worklet runtime

---

## Axioms

1. Root is slot 0. Always alive. Version = 1. Enabled = 1. Cannot be attached, detached, destroyed, or reparented.
2. Every mutation validates: liveness → version match. In that order.
3. No node may have two parents (attach rejects already-parented nodes).
4. No cycles (reparent walks the parent chain to detect ancestry).
5. Freed slots return to LIFO free list with version bump. Any old reference to that slot is permanently stale.
6. One component per type per node.
7. Registered pools are cleaned during destroy, before the slot is freed. Unregistered pools are the caller's responsibility.
8. Storage arrays are encapsulated within factory closures. No external code touches raw memory (except via `getStorage()` for engine-level systems and testing).
9. Structural tree mutations are deferred during system execution. **Enforced at runtime** — direct calls to `destroy()`, `attach()`, `detach()`, `reparent()` throw during `step()`. Systems enqueue commands; the world flushes them after all systems run.
10. Systems run sequentially in registration order. No parallelism guarantees.
11. `step()` is non-reentrant. Calling `step()` during `step()` is an error.
12. Every node has a local and world transform. Both reset to identity on allocate and free.
13. World transforms are computed by propagation, never written directly by user code.
14. Disabled nodes and their subtrees are skipped by transform propagation. Their world transforms retain their last computed value.
15. `worldEnabled[x] = 0` ⟺ `enabled[x] = 0 ∨ ∃ ancestor a of x : enabled[a] = 0`. Maintained by `setEnabled`, `attach`, `detach`, and `reparent`. Render collection checks `worldEnabled`, not `enabled`.

---

## Operation Contracts

### Node Lifecycle

| Operation | Preconditions | Postconditions |
|---|---|---|
| `createNode()` | Free list non-empty | Slot popped, alive=1, enabled=1, worldEnabled=1, version bumped, NodeHandle returned |
| `destroy(ref)` | Valid ref, not root | Subtree destroyed depth-first. For each node: pools cleaned, slot freed (worldEnabled reset to 1), version bumped |

### Tree Mutations

| Operation | Preconditions | Postconditions |
|---|---|---|
| `attach(child, parent)` | Both valid, child ≠ root, child parentless, child ≠ parent | Child head-inserted into parent's child list. worldEnabled reconciled for attached subtree |
| `detach(child)` | Valid, ≠ root, has parent | Child spliced from sibling list, parent cleared. If detached from worldDisabled parent, subtree worldEnabled restored |
| `reparent(node, newParent)` | Both valid, ≠ root, ≠ self, has parent, no cycle, ≠ current parent | Unlinked from old parent, head-inserted into new parent. worldEnabled reconciled for moved subtree |

### Component Pool

| Operation | Preconditions | Postconditions |
|---|---|---|
| `add(ref)` | Valid ref, no existing component, pool not full | Component appended at `count`, both mappings set, count++ |
| `remove(ref)` | Valid ref, has component | Swap-and-pop: last fills gap, `swapFn` called, moved entry's mappings updated, count-- |
| `has(ref)` | Valid ref | Returns boolean |
| `get(ref)` | Valid ref, has component | Returns dense index |
| `getByNodeId(nodeId)` | (none) | Returns dense index or NULL (-1). No validation — fast path for system iteration |
| `getNodeHandle(index)` | 0 ≤ index < count | Returns NodeHandle for the entity at that dense index |
| `nodeIdAt(i)` | 0 ≤ i < count | Returns owning node id |

### World-Pool Integration

| Operation | Preconditions | Postconditions |
|---|---|---|
| `registerPool(pool)` | Pool belongs to this world, not already registered | Added to registry set |
| Destroy cleanup | (internal, per registered pool) | `_removeByNodeId` called for each destroyed node before free |

### Command Buffer

| Operation | Preconditions | Postconditions |
|---|---|---|
| `destroy(ref)` | (none at enqueue) | Command queued. On flush: `world.destroy(ref)` with full validation |
| `attach(child, parent)` | (none at enqueue) | Command queued. On flush: `world.attach(child, parent)` |
| `detach(child)` | (none at enqueue) | Command queued. On flush: `world.detach(child)` |
| `reparent(node, parent)` | (none at enqueue) | Command queued. On flush: `world.reparent(node, parent)` |
| `flush()` | (none) | All commands executed FIFO, queue cleared |
| `clear()` | (none) | Queue discarded without execution |

### Transform Accessors

| Operation | Preconditions | Postconditions |
|---|---|---|
| `setLocalTransform(ref, a, b, tx, ty)` | Valid ref | Local transform columns updated |
| `getLocalTransform(ref)` | Valid ref | Returns `{a, b, tx, ty}` |
| `setLocalPosition(ref, tx, ty)` | Valid ref | Only `localTx` and `localTy` updated; `localA` and `localB` unchanged |
| `getWorldTransform(ref)` | Valid ref | Returns `{a, b, tx, ty}` |
| `createTransformPropagationSystem()` | (none) | Returns a System that performs pre-order tree walk, composing world transforms from local transforms. Skips disabled subtrees |

### Render Collection

| Operation | Preconditions | Postconditions |
|---|---|---|
| `createRenderCollectionSystem(spritePool, spriteTypeData)` | spritePool registered with this world | Returns `{ system, buffer }`. System iterates SpritePool, gathers world transforms for worldEnabled sprites into pre-allocated RenderBuffer |

The RenderBuffer is the kernel's output contract — parallel typed arrays sized to `spritePool.capacity`:

```typescript
interface RenderBuffer {
    readonly transforms: Float32Array;  // [a₀,b₀,tx₀,ty₀, a₁,b₁,tx₁,ty₁, ...]
    readonly spriteTypes: Int32Array;   // [type₀, type₁, ...]
    count: number;                      // valid entries this frame
}
```

The system performs a **gather operation**: it reads from two index spaces (SpritePool component indices for sprite type, scattered node IDs for world transforms) and writes them into the contiguous output buffer. No consumer ever sees a node ID. The buffer is pre-allocated at system creation time — zero per-frame heap allocations.

### Frame Loop

| Operation | Preconditions | Postconditions |
|---|---|---|
| `addSystem(system)` | system is a function | System appended to execution list |
| `step(dt)` | Not currently inside a step | All systems run in order with dt, then command buffer flushed, stepping flag cleared. On system throw: buffer cleared, flag cleared, error re-thrown |

---

## Design Decisions

### Closure-Factory Architecture

All kernel modules are closure-factory functions returning plain POJOs. No classes, no prototypes.

**Why**: The kernel runs on a worklet thread via `createWorkletRuntime`. Worklet serialization transfers function bodies and closure captures across thread boundaries but strips prototype chains — class methods become `undefined`. Factory POJOs with methods as own properties survive serialization intact. Verified empirically: A2 (classes fail) → A3 (factories pass, 18/18).

**Tradeoff**: No `instanceof` checks. Pool `belongsTo(world)` uses reference equality instead. Slightly more verbose factory signatures (e.g., `swapFn` callback replaces abstract method override).

### SoA Memory Layout

All node data in parallel `Int32Array` columns indexed by slot ID.

**Why**: Cache-friendly linear scans. Compatible with `SharedArrayBuffer` for future cross-thread sharing. Zero per-node heap allocation, zero GC pressure.

**Tradeoff**: Fixed capacity declared upfront. No auto-growth. Caller must predict peak entity count.

### Generational Indices

Every slot has a monotonically increasing version. NodeHandle tuples carry `{id, version}`. All operations reject version mismatches.

**Why**: In a slot-reuse architecture, a freed integer ID becomes a dangling pointer when that slot is reallocated. Generational indices prevent silent corruption. Borrowed from Rust ECS engines (Bevy, hecs, legion).

**Tradeoff**: One integer comparison per operation. Negligible.

### World-Agnostic Handles

NodeHandle tuples carry no world reference — just `{id, version}`.

**Why**: Handles that reference a world object create serialization dependencies and cross-world coupling. World-agnostic handles are pure data, freely copyable, and survive worklet serialization. Validation happens at the call site: `world.assertValidRef(handle)` checks liveness and version against the world's storage.

**Tradeoff**: No compile-time guarantee that a handle belongs to the correct world. A handle from world A could be passed to world B. In practice this doesn't matter — games use a single world instance.

### Doubly-Linked Sibling Lists

Children stored via `firstChild`/`nextSibling`/`prevSibling`. O(1) head-insert on attach, O(1) splice on detach.

**Why**: Dynamic arrays per node require O(n) filter on detach and defeat SoA layout. Linked lists keep structural mutations constant-time.

**Tradeoff**: Sibling traversal is pointer-chasing, not linear scan. Acceptable — hot iteration should go through component pools, not the tree.

### Component Pool with Swap Callback

`createComponentPool(world, capacity, swapFn)` takes a user-provided callback to swap data at two indices during removal.

**Why**: The pool manages index bookkeeping (node↔component mappings, count, swap-and-pop). The user owns their TypedArrays directly. The swap callback bridges the two concerns without inheritance. This pattern is more composable than abstract class inheritance and compatible with worklet serialization.

**Tradeoff**: User must ensure their swap callback correctly swaps ALL their data arrays. If they add a data column and forget to update the swap function, data corruption occurs silently.

### Dense Component Pools with Swap-and-Pop

Each component type gets a dedicated pool. Dense storage `0..count-1`. Removal swaps with last entry, decrements count.

**Why**: O(1) removal. No holes in the dense region. Iteration is a tight linear loop. `nodeToComponent` gives O(1) lookup. `componentToNode` gives reverse mapping for iteration.

**Tradeoff**: Component indices are unstable across removals. Never cache a component index across frames.

### Pool Registry

World owns a `Set<ComponentPool>`. Registered pools are cleaned during `_destroySubtree`.

**Why**: Without cleanup, destroying a node with components leaves stale entries — `nodeToComponent` points to a freed slot that may be reused by a different entity.

**Tradeoff**: Only registered pools are cleaned. Intentional — allows pools with lifecycles independent of a single world.

### Systems as Functions

Systems are `(world: FlatWorld, dt: number) => void`. Not classes. Not interfaces with lifecycle hooks.

**Why**: Systems have no state of their own. If a system needs persistent state, that state is a component on some entity, not a field on the system. Functions are the simplest correct abstraction for stateless transforms over pool data. System factories (closures over pools) provide the binding without adding type machinery.

**Tradeoff**: No built-in way to declare which pools a system reads/writes. Scheduling and access validation are the caller's responsibility. Sufficient for sequential single-threaded execution; would need extension for parallelism.

### RSXform Transform Representation

Transforms stored as 4 `Float32Array` columns per set: `a` (sCosθ), `b` (sSinθ), `tx`, `ty`. RSXform layout — uniform scale + rotation encoded as a single complex-number-like pair.

**Why**: Three operations matter for transforms — composition (every node, every frame), position mutation (common), and extraction for rendering (every visible node, every frame). RSXform makes composition pure arithmetic (8 multiplies, 4 adds, no trig). Position mutation is a direct write to `tx`/`ty`. Extraction for the render packet (Skia `RSXform`) is zero-cost — the data is already in the target format.

**Tradeoff**: Reading rotation angle or scale individually requires `atan2` or `sqrt`. Acceptable — these are uncommon queries, not per-frame costs. Non-uniform scale (sx ≠ sy) is not representable. Acceptable for 2D game engines — non-uniform scale introduces shear under composition anyway.

### Storage Columns vs Component Pools for Transforms

Transforms are storage columns (like `enabled`), not component pools (like Position or Velocity).

**Why**: Every node needs a transform — it's part of what a node is, not optional data. A component pool's `nodeToComponent` mapping costs `O(capacity)` anyway, so there are no space savings. Storage columns give O(1) indexed access by nodeId with no indirection.

**Tradeoff**: Nodes that don't need transforms (e.g., pure logical grouping nodes) still pay 8 floats. Negligible — 32 bytes per node.

### Engine Systems vs User Systems

Transform propagation and render collection are **engine-level systems** — tightly coupled to storage internals, created via `world.createTransformPropagationSystem()` and `world.createRenderCollectionSystem()`. User systems close over component pools and have no direct storage access.

**Why**: Engine systems read structural arrays (`parent`, `firstChild`, `nextSibling`, `enabled`, `worldEnabled`) and write to transform columns or render buffers. Exposing storage would let user code corrupt tree invariants. Factory methods on the world grant scoped access via closure without exposing storage publicly.

**Tradeoff**: Engine systems require a factory method on the world per system type. Acceptable — there are few engine systems (propagation, render collection). User systems remain pure functions over pools.

### worldEnabled — Hierarchy-Aware Visibility

Every node has two enabled flags: `enabled` (individual) and `worldEnabled` (effective). `worldEnabled` is maintained by `setEnabled`, `attach`, `detach`, and `reparent`.

**Why**: Render collection iterates the SpritePool (flat, dense, cache-friendly). It cannot walk the tree to check ancestor enabled state — that would be O(h) per sprite. `worldEnabled` gives O(1) visibility checks during flat pool iteration by pre-computing hierarchy-dependent visibility at mutation time.

**Invariant**: `worldEnabled[x] = 0` ⟺ `enabled[x] = 0 ∨ ∃ ancestor a : enabled[a] = 0`.

**Tradeoff**: `setEnabled`, `attach`, `detach`, and `reparent` become O(subtree) instead of O(1). Acceptable — structural mutations are infrequent, render collection runs every frame.

### Render Collection as Gather Operation

The render collection system iterates the SpritePool densely, reads world transforms from scattered storage positions via node ID indirection, and writes them into a contiguous pre-allocated RenderBuffer.

**Why**: Internal kernel layout is optimized for simulation (SoA, stable indices). The consumer (Skia bridge) needs contiguous data in a different layout (parallel RSXform and sprite type arrays). The gather operation bridges these two index spaces. The buffer is pre-allocated once — zero per-frame heap allocations, zero GC pressure.

**Tradeoff**: One indirection per sprite (nodeIdAt → storage lookup). Acceptable — single array read, sequential output write.

### SpritePool as ComponentPool Wrapper

`createSpritePool(world, capacity)` wraps `createComponentPool` with a `spriteType: Int32Array` data column and a swap callback.

**Why**: Establishes the pattern for future component types (AnimationPool, etc.) without adding generic machinery to ComponentPool. The pool manages index bookkeeping; the factory owns the typed data arrays.

### Deferred Structural Mutations

Systems enqueue structural commands into a CommandBuffer. Commands execute after all systems have run.

**Why**: Structural mutations (destroy, attach, detach, reparent) change pool indices (swap-and-pop) and tree structure. Executing them mid-iteration corrupts the data a system is reading. Deferral guarantees pool index stability within a system's execution.

**Tradeoff**: Systems cannot observe the results of their structural commands within the same frame. A system that creates and then queries a node must accept that the query uses pre-mutation state. For reparenting, this means the child's world transform reflects the old parent on the reparent frame and the new parent on the next frame.

### Runtime Authority Invariant

One authoritative simulation owner at runtime. It owns all game state: nodes, components, transforms, physics, collision, commands, frame ordering. Other runtimes (JS/React) may submit commands or receive snapshots but never partially own simulation state.

**Why**: Split authority creates synchronization bugs that are nearly impossible to debug at 60fps.

### Boundary Invariant

Cross-runtime communication is not part of the core frame loop. JS/React may create initial scenes, send input, send commands, receive debug snapshots. JS/React is never required for: physics step, collision detection, transform propagation, script update, render collection.

**Why**: The core loop must run without blocking on JS bridge latency.
