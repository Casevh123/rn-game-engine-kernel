# Engine Specification

> The abstract model for a data-oriented game engine kernel. Tests are the executable spec. This document captures what tests cannot: the model, the invariants, and why decisions were made.

---

## Abstract Model

### Entities (Nodes)

An entity is an integer slot in a fixed-capacity memory pool. Slots are backed by parallel `Int32Array` columns (struct-of-arrays). Each slot carries:

- **Structural links**: parent, firstChild, nextSibling, prevSibling
- **Lifecycle state**: alive, enabled, version
- **Allocator state**: freeNext (free-list linkage)

Entities form a **rooted tree**. Slot 0 is the root — always alive, never freed. Remaining slots begin on a singly-linked free list. Allocation pops from the head; freeing pushes back (LIFO reuse with version bump).

### The Tree

Children are stored as a **doubly-linked sibling list** per parent. Structural mutations are O(1):

- **Attach**: head-insert into parent's child list
- **Detach**: linked-list splice
- **Destroy**: recursive depth-first — children first, then unlink from parent, clean component pools, free slot
- **Reparent**: inline unlink + head-insert (not detach→attach, which would reject the parentless intermediate state)

### Components

Components are **data, not behavior**. No `update()` methods. No lifecycle hooks.

Each component type has a dedicated **ComponentPool** — a dense array where live components occupy indices `0..count-1`. Removal uses **swap-and-pop**: the last entry fills the gap, maintaining density without holes.

Each pool maintains three mappings:

- `nodeToComponent[nodeId]` → component index (O(1) "has?" and "where?")
- `componentToNode[compId]` → node id (reverse mapping for iteration)
- `componentToVersion[compId]` → generation (stale entry detection)

One component per type per node. Pools are registered with the world for automatic cleanup on destroy.

### Systems

A system is a function `(world, dt) → void` that reads and writes component pool data. Systems are **behavior without data** — the counterpart to components, which are **data without behavior**.

Systems are registered on the world via `addSystem()` and run sequentially in registration order during `step(dt)`. Systems may iterate pools (flat, cache-friendly) or walk the tree (for hierarchy-dependent operations like transform propagation). The system contract constrains **mutation rules**, not **iteration strategy**.

### Command Buffer

Structural mutations (destroy, attach, detach, reparent) must not occur during system execution — they would invalidate pool indices mid-iteration (swap-and-pop changes order) and corrupt tree structure mid-traversal. Instead, systems enqueue mutations into a **CommandBuffer** that executes them after all systems have run.

`createNode()` is immediate (free-list pop, no pool impact). Component `pool.add()` / `pool.remove()` are immediate but must not target a pool currently being iterated by the calling system.

### Frame Loop

`World.step(dt)` is the frame:

1. Run all registered systems in order, each receiving `(world, dt)`
2. Flush the command buffer (execute all deferred mutations in FIFO order)

Step is non-reentrant. If a system throws, the command buffer is not flushed (partial-frame state is unsafe to commit), but the stepping guard is cleared via `try/finally` so the world remains usable.

### References

A reference is a `(world, id, version)` tuple — a **generational handle**. The version prevents use-after-free: if a slot has been freed and reallocated, old references are rejected because their version no longer matches. References are ephemeral facades created on the fly, not cached.

### World

The world owns the memory pool, the pool registry, the system list, the command buffer, and all mutation authority. Every operation goes through the world. Every operation validates ownership and liveness before proceeding.

---

## Axioms

1. Root is slot 0. Always alive. Version = 1. Enabled = 1. Cannot be attached, detached, destroyed, or reparented.
2. Every mutation validates: world ownership → liveness → version match. In that order.
3. No node may have two parents (attach rejects already-parented nodes).
4. No cycles (reparent walks the parent chain to detect ancestry).
5. Freed slots return to LIFO free list with version bump. Any old reference to that slot is permanently stale.
6. One component per type per node.
7. Registered pools are cleaned during destroy, before the slot is freed. Unregistered pools are the caller's responsibility.
8. Storage arrays are private. No external code touches raw memory.
9. Structural tree mutations are deferred during system execution. Systems enqueue commands; the world flushes them after all systems run.
10. Systems run sequentially in registration order. No parallelism guarantees.
11. `step()` is non-reentrant. Calling `step()` during `step()` is an error.

---

## Operation Contracts

### Node Lifecycle

| Operation | Preconditions | Postconditions |
|---|---|---|
| `createNode()` | Free list non-empty | Slot popped, alive=1, enabled=1, version bumped, ref returned |
| `destroy(ref)` | Valid ref, not root | Subtree destroyed depth-first. For each node: pools cleaned, slot freed, version bumped |

### Tree Mutations

| Operation | Preconditions | Postconditions |
|---|---|---|
| `attach(child, parent)` | Both valid, child ≠ root, child parentless, child ≠ parent | Child head-inserted into parent's child list |
| `detach(child)` | Valid, ≠ root, has parent | Child spliced from sibling list, parent cleared |
| `reparent(node, newParent)` | Both valid, ≠ root, ≠ self, has parent, no cycle, ≠ current parent | Unlinked from old parent, head-inserted into new parent |

### Component Pool

| Operation | Preconditions | Postconditions |
|---|---|---|
| `add(ref)` | Valid ref, no existing component, pool not full | Component appended at `count`, both mappings set, count++ |
| `remove(ref)` | Valid ref, has component | Swap-and-pop: last fills gap, moved entry's mappings updated, count-- |
| `has(ref)` | Valid ref | Returns boolean |
| `get(ref)` | Valid ref, has component | Returns dense index |
| `getByNodeId(nodeId)` | (none) | Returns dense index or NULL (-1). No validation — fast path for system iteration |
| `getNode(index)` | 0 ≤ index < count | Returns FlatNodeRef for the entity at that dense index |
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

### Frame Loop

| Operation | Preconditions | Postconditions |
|---|---|---|
| `addSystem(system)` | system is a function | System appended to execution list |
| `step(dt)` | Not currently inside a step | All systems run in order with dt, then command buffer flushed, stepping flag cleared |

---

## Design Decisions

### SoA Memory Layout

All node data in parallel `Int32Array` columns indexed by slot ID.

**Why**: Cache-friendly linear scans. Compatible with `SharedArrayBuffer` for future cross-thread sharing. Zero per-node heap allocation, zero GC pressure.

**Tradeoff**: Fixed capacity declared upfront. No auto-growth. Caller must predict peak entity count.

### Generational Indices

Every slot has a monotonically increasing version. References carry `(id, version)`. All operations reject version mismatches.

**Why**: In a slot-reuse architecture, a freed integer ID becomes a dangling pointer when that slot is reallocated. Generational indices prevent silent corruption. Borrowed from Rust ECS engines (Bevy, hecs, legion).

**Tradeoff**: One integer comparison per operation. Negligible.

### Doubly-Linked Sibling Lists

Children stored via `firstChild`/`nextSibling`/`prevSibling`. O(1) head-insert on attach, O(1) splice on detach.

**Why**: Dynamic arrays per node require O(n) filter on detach and defeat SoA layout. Linked lists keep structural mutations constant-time.

**Tradeoff**: Sibling traversal is pointer-chasing, not linear scan. Acceptable — hot iteration should go through component pools, not the tree.

### Facade Pattern

Users interact with `FlatNodeRef` (an OOP-style handle). All calls delegate to `FlatWorld`, which owns private storage.

**Why**: DOD performance with OOP ergonomics. `node.enabled = false` routes to `storage.enabled[id] = 0`. Same pattern as Unity DOTS.

**Tradeoff**: References are ephemeral. `getParent() === getParent()` is `false`. Use `.equals()` for logical equality.

### Dense Component Pools with Swap-and-Pop

Each component type gets a dedicated pool. Dense storage `0..count-1`. Removal swaps with last entry, decrements count.

**Why**: O(1) removal. No holes in the dense region. Iteration is a tight linear loop. `nodeToComponent` gives O(1) lookup. `componentToNode` gives reverse mapping for iteration.

**Tradeoff**: Component indices are unstable across removals. Never cache a component index across frames.

### Abstract Base Class for Pools

`ComponentPool` is abstract. Subclasses implement `swapComponentData()` for their typed arrays.

**Why**: Bookkeeping (mappings, count, swap-and-pop) is invariant across all component types. Domain data (position, health, velocity) varies. One place for invariant enforcement, arbitrary data layouts per type.

### Pool Registry

World owns a `Set<ComponentPool>`. Registered pools are cleaned during `_destroySubtree`.

**Why**: Without cleanup, destroying a node with components leaves stale entries — `nodeToComponent` points to a freed slot that may be reused by a different entity.

**Tradeoff**: Only registered pools are cleaned. Intentional — allows pools with lifecycles independent of a single world.

### Systems as Functions

Systems are `(world: FlatWorld, dt: number) => void`. Not classes. Not interfaces with lifecycle hooks.

**Why**: Systems have no state of their own. If a system needs persistent state, that state is a component on some entity, not a field on the system. Functions are the simplest correct abstraction for stateless transforms over pool data. System factories (closures over pools) provide the binding without adding type machinery.

**Tradeoff**: No built-in way to declare which pools a system reads/writes. Scheduling and access validation are the caller's responsibility. Sufficient for sequential single-threaded execution; would need extension for parallelism.

### Deferred Structural Mutations

Systems enqueue structural commands into a CommandBuffer. Commands execute after all systems have run.

**Why**: Structural mutations (destroy, attach, detach, reparent) change pool indices (swap-and-pop) and tree structure. Executing them mid-iteration corrupts the data a system is reading. Deferral guarantees pool index stability within a system's execution.

**Tradeoff**: Systems cannot observe the results of their structural commands within the same frame. A system that creates and then queries a node must accept that the query uses pre-mutation state.

### Runtime Authority Invariant

One authoritative simulation owner at runtime. It owns all game state: nodes, components, transforms, physics, collision, commands, frame ordering. Other runtimes (JS/React) may submit commands or receive snapshots but never partially own simulation state.

**Why**: Split authority creates synchronization bugs that are nearly impossible to debug at 60fps.

### Boundary Invariant

Cross-runtime communication is not part of the core frame loop. JS/React may create initial scenes, send input, send commands, receive debug snapshots. JS/React is never required for: physics step, collision detection, transform propagation, script update, render collection.

**Why**: The core loop must run without blocking on JS bridge latency.
