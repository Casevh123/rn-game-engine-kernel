# Plan

> **Last updated:** 2026-05-01  
> **Status:** Implementing `destroy` and `reparent` for `flat_tree`

---

## Current Milestone: flat_tree Feature Parity (Structural Mutations)

The goal is to bring `flat_tree` to feature parity with `state_tree` for all structural mutation operations. `attach` and `detach` are complete. `destroy` and `reparent` are next.

### Completed

- [x] `FlatTreeStorage` — SoA memory pool with free-list allocator
- [x] `FlatWorld.createNode()` — slot allocation, returns `FlatNodeRef`
- [x] `FlatWorld.attach()` — head-insert into doubly-linked sibling list
- [x] `FlatWorld.detach()` — linked-list splice, clears parent
- [x] `FlatWorld.getParent()` / `getChildren()` — on-the-fly `FlatNodeRef` creation with correct versions
- [x] `FlatWorld.isEnabled()` / `setEnabled()` — read/write enabled lane
- [x] `FlatWorld.isAlive()` — non-throwing alive + version check
- [x] `FlatWorld.assertInWorld()` — cross-world ownership validation
- [x] `FlatNodeRef.equals()` — reference comparison by id + version
- [x] `FlatNodeRef.belongsTo()` — ownership verification
- [x] Private `_storage` — encapsulation boundary restored
- [x] Tests through public API — resilient to storage layout changes

### In Progress

- [ ] `FlatWorld.destroy(ref)` — detach from parent + recursively free subtree
- [ ] `FlatWorld.reparent(node, newParent)` — detach + re-attach with cycle detection

### Up Next (in dependency order)

- [ ] `traversePreOrder()` — iterative walk via `firstChild`/`nextSibling` with reusable stack
- [ ] `FlatCommandBus` — deferred mutation queue (same pattern as state_tree)
- [ ] Component system design decision
- [ ] Update loop (`update(dt)`)

---

## destroy — Implementation Plan

### Behavior

`destroy(ref)` removes a node and its entire subtree from the world. All destroyed slots are freed and become reusable.

### Algorithm

```
destroy(ref):
    assertInWorld(ref)
    reject if root
    _destroySubtree(ref.id)

_destroySubtree(id):
    for each child (walk firstChild → nextSibling):
        save nextSibling before recursing (free() zeroes pointers)
        _destroySubtree(child)
    if has parent:
        unlink from sibling list (same logic as detach)
    free(id)
```

### Guard Clauses

- Cannot destroy root
- Cannot destroy stale ref
- Cannot destroy cross-world ref

### Design Decision: Can you destroy a detached node (no parent)?

`state_tree` allows it — `destroy()` checks `if (node.parent !== null)` before unlinking. A detached node can still be destroyed (it just skips the parent-unlinking step). `flat_tree` should match this behavior.

---

## reparent — Implementation Plan

### Behavior

`reparent(node, newParent)` moves a node from its current parent to a new parent. The node's subtree moves with it.

### Algorithm

```
reparent(node, newParent):
    assertInWorld(node)
    assertInWorld(newParent)
    reject if root, self-reparent, no current parent, cycle
    
    unlink from old parent's sibling list (inline, don't call detach())
    head-insert into new parent's child list (inline, don't call attach())
```

The implementation inlines the detach+attach logic rather than calling the public methods. This avoids the issue where `detach()` sets `parent = NULL` and then `attach()` would reject the parentless node.

### Guard Clauses

- Cannot reparent root
- Cannot reparent to self
- Cannot reparent node without a current parent (use `attach` instead)
- Cannot create cycles (walk parent chain from newParent upward, check for node)
- Cannot reparent cross-world refs
- Cannot reparent stale refs

### Cycle Detection

```
_isAncestor(possibleAncestorId, nodeId):
    current = parent[nodeId]
    while current !== NULL:
        if current === possibleAncestorId: return true
        current = parent[current]
    return false
```

O(depth) — walks up the parent chain from `newParent`. If `node` is found as an ancestor of `newParent`, reparenting would create a cycle.

---

## Test Plan for destroy

### Happy Path

| Test | What it validates |
|---|---|
| Removes node from parent children list | Parent's child list no longer contains the node |
| Node ref becomes stale after destroy | `isAlive()` returns `false` for destroyed ref |
| Freed slot can be reallocated | `createNode()` reuses the destroyed slot |
| Destroys all children recursively | All children of destroyed node also become dead |
| Destroys deep subtree (3+ levels) | Works for grandchildren and beyond |
| All descendant refs become stale | `isAlive()` returns `false` for all descendants |
| All descendant slots are freed and reusable | `createNode()` reuses descendant slots |
| Destroying first child updates parent firstChild | Sibling list head pointer moves |
| Destroying middle child links prev and next | Siblings relink correctly |
| Destroying last child updates prev sibling | Sibling list tail terminates |
| Destroying only child sets parent firstChild to NULL | Empty child list |
| Parent still has remaining children after partial destroy | Surviving siblings intact |
| Surviving siblings maintain correct order | Order is preserved |

### Error Cases

| Test | What it validates |
|---|---|
| Cannot destroy root | Root protection invariant |
| Cannot destroy stale ref | Generational index safety |
| Cannot destroy cross-world ref | Ownership validation |

### Edge Cases

| Test | What it validates |
|---|---|
| Destroying a leaf node works | No children to recurse into |
| Destroying a detached node frees it | No parent to unlink from |
| Destroying a node with disabled children still frees them | Enabled state is irrelevant to destroy |
| Double destroy of same ref throws | Stale ref after first destroy |

---

## Test Plan for reparent

### Happy Path

| Test | What it validates |
|---|---|
| Moves node from old parent to new parent | Parent ref changes |
| Old parent no longer has node as child | Old child list updated |
| New parent has node as child | New child list updated |
| Node parent ref points to new parent | `getParent()` returns new parent |
| Children are preserved after reparent | Subtree moves intact |
| Reparent with subtree preserves all descendants | Deep subtree is intact |
| Reparent first child — old parent firstChild updates | Old sibling list head moves |
| Reparent middle child — old parent siblings relink | Old siblings reconnect |
| Reparent last child — old parent list terminates | Old sibling list tail fixed |
| Reparent only child — old parent firstChild becomes NULL | Old parent becomes childless |
| Reparented node becomes head of new parent child list | Head-insert at new parent |
| Existing children of new parent shift down | New parent's old first child moves |

### Error Cases

| Test | What it validates |
|---|---|
| Cannot reparent root | Root protection |
| Cannot reparent cross-world (node) | Ownership validation |
| Cannot reparent cross-world (parent) | Ownership validation |
| Cannot reparent stale node ref | Generational index safety |
| Cannot reparent to stale parent ref | Generational index safety |
| Cannot reparent to self | Self-cycle prevention |
| Cannot reparent parentless node | Must use attach instead |
| Cannot reparent to own child (direct cycle) | Cycle detection |
| Cannot reparent to own grandchild (indirect) | Cycle detection |
| Cannot reparent to deep descendant (transitive) | Cycle detection |

### Edge Cases

| Test | What it validates |
|---|---|
| Reparent to current parent | Design decision: no-op or throw? |
| Reparent preserves enabled state | Enabled flag not modified |
| Reparent does not change node version | Version unchanged (no free/realloc) |

---

## Future Milestones

### Milestone 2: Traversal + Update Loop

- `traversePreOrder()` — iterative, stack-based, reusable buffer
- `FlatCommandBus` + `FlatCommandBuffer` — deferred mutation queue
- `update(dt)` — traverse → update → flush

### Milestone 3: Component System

The hardest open design question. Three options:

1. **Class instances in `Map<number, Component[]>`** — easy, but loses cache locality
2. **Component data in typed arrays** — maximum performance, rigid
3. **Archetype-based storage** (like Bevy/Unity DOTS) — correct for ECS, complex

### Milestone 4: React Native Integration

- Skia rendering pipeline
- Reanimated UI-thread execution via SharedArrayBuffer/SharedValue
- Worklet constraints for user scripts
