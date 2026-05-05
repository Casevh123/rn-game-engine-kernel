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

### References

A reference is a `(world, id, version)` tuple — a **generational handle**. The version prevents use-after-free: if a slot has been freed and reallocated, old references are rejected because their version no longer matches. References are ephemeral facades created on the fly, not cached.

### World

The world owns the memory pool, the pool registry, and all mutation authority. Every operation goes through the world. Every operation validates ownership and liveness before proceeding.

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
| `nodeIdAt(i)` | 0 ≤ i < count | Returns owning node id |

### World-Pool Integration

| Operation | Preconditions | Postconditions |
|---|---|---|
| `registerPool(pool)` | Pool belongs to this world, not already registered | Added to registry set |
| Destroy cleanup | (internal, per registered pool) | `_removeByNodeId` called for each destroyed node before free |

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

### Runtime Authority Invariant

One authoritative simulation owner at runtime. It owns all game state: nodes, components, transforms, physics, collision, commands, frame ordering. Other runtimes (JS/React) may submit commands or receive snapshots but never partially own simulation state.

**Why**: Split authority creates synchronization bugs that are nearly impossible to debug at 60fps.

### Boundary Invariant

Cross-runtime communication is not part of the core frame loop. JS/React may create initial scenes, send input, send commands, receive debug snapshots. JS/React is never required for: physics step, collision detection, transform propagation, script update, render collection.

**Why**: The core loop must run without blocking on JS bridge latency.

---

## Reference Implementation

`state_tree` is the original object-graph prototype. It implements the same scene-graph concept using class instances, string IDs, `Array<TreeNode>` children, and class-based components with `update()` methods. It serves as a behavioral reference for tree operations and the command bus pattern.

`state_tree` will diverge from `flat_tree` as the component model evolves — class instances cannot be shared across thread boundaries, and `update()` methods on components are incompatible with the data-oriented system model. Plan to archive it once `flat_tree` is stable.
