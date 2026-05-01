# Review

> Critical analysis of the current architecture, design decisions, and the path forward.

---

## What's Working Well

### 1. Test-Driven Development, Genuinely

The git history shows features and tests arriving together in every commit. This isn't "tests added after the fact" — it's real TDD. The test suite is organized by concern (storage, world, commands, traversal, integration), covers happy paths, error paths, and edge cases, and the integration tests prove the full update loop end-to-end including deferred self-destruction.

### 2. The CommandBuffer Pattern Is the Most Architecturally Significant Decision

If a component calls `world.destroy(someNode)` during traversal, the node disappears mid-iteration — a concurrent modification bug that most hobby game engines discover 200 hours in when something intermittently crashes. The `CommandBuffer` defers mutations until traversal completes. This was designed in from the start, not bolted on after a bug was found. It shows genuine experience with game engine pitfalls.

### 3. The flat_tree Encapsulation Evolution

The progression from public `storage` → private `_storage` with query methods was done correctly and methodically. The tests were migrated from raw array assertions to public API assertions, making them resilient to future storage layout changes. The cross-world ownership validation (`assertInWorld`/`belongsTo`) was added cleanly — a separate method rather than polluting existing validation with more checks.

### 4. Generational Indices Are a Sophisticated Choice for TypeScript

The `(id, version)` pattern is borrowed from Rust game engines (Bevy, hecs, legion) where it prevents use-after-free in arenas/slotmaps. Most TypeScript game engines don't bother with this because JavaScript doesn't have raw memory bugs. But in a flat-array architecture with slot reuse, you do get the equivalent: a stale integer index pointing to a completely different entity. The fact that this was designed in from the start, rather than discovered after a debugging nightmare, is impressive.

### 5. The Façade Pattern Resolves the DOD/OOP Tension Elegantly

The core tension in `flat_tree` is: data-oriented design requires flat arrays, but developers want OOP ergonomics. `FlatNodeRef` resolves this by acting as a lightweight proxy — `player.enabled = false` looks like OOP but routes to `storage.enabled[id] = 0`. This is the same pattern Unity DOTS uses, and it's the right call.

### 6. Zero Runtime Dependencies

The engine core has no platform coupling whatsoever. Pure TypeScript, no React, no RN, no external libraries. This is the right foundation — platform integration should be a layer on top, not baked into the core.

---

## Concerns and Weaknesses

### 1. `free()` Is Unsafe When Called on Attached Nodes

`FlatTreeStorage.free()` zeroes the node's own pointers (parent, firstChild, siblings) but **does not update the parent's `firstChild` or the siblings' `prev`/`next` links**. If you call `free()` on a node that's still attached, the parent's child list becomes corrupted — it points to a dead slot that may be reused.

This is not a bug in current usage because `free()` is only called from tests on freshly-allocated, unattached nodes. But it's a landmine. When `destroy()` is implemented, it must detach before freeing, and `free()` should arguably assert `parent[id] === NULL && firstChild[id] === NULL` as a safety net.

**Risk level:** High. This will be the #1 source of bugs during destroy implementation if not handled carefully.

### 2. `FlatNodeRef` Double-Validation on `enabled` Access

The `enabled` getter on `FlatNodeRef` calls `this.assertValid()` (which does `assertValidRef()`), then delegates to `world.isEnabled()` which calls `assertInWorld()` (which does `assertValidRef()` again). This means alive+version is checked twice per property access.

For a property that will be read every frame for every node during traversal, this is wasted work. Not critical now, but when you're running 60fps on mobile with hundreds of entities, doubling your validation overhead on hot paths is measurable.

**Fix:** Either remove the `assertValid()` from the `FlatNodeRef` getter (let `FlatWorld` be the validation boundary), or have `FlatNodeRef` call `assertInWorld()` directly instead of `assertValidRef()`, and remove the validation from the `FlatWorld` method.

### 3. `FlatNodeRef.assertValid()` Uses `assertValidRef()`, Not `assertInWorld()`

`FlatNodeRef.assertValid()` calls `this.world.assertValidRef(this)`, which only checks alive + version — it does NOT check world ownership. Since the `world` reference is private and set at construction, this is technically safe (the ref always calls its own world). But it creates an inconsistency: all `FlatWorld` methods use `assertInWorld()`, but `FlatNodeRef.assertValid()` bypasses the ownership check.

If someone refactors `FlatNodeRef` to accept a different world later, this becomes a silent bug. Consider making `assertValid()` call `assertInWorld()` instead.

### 4. No `removeComponent()` in state_tree

`TreeNode.addComponent()` exists but there's no `removeComponent()`. Once attached, a component lives forever on that node. This is fine for simple prototypes but becomes a real limitation for gameplay patterns like:
- Temporary buffs/debuffs
- State machine transitions (swap AI components)
- Object pooling (clear components before reuse)

### 5. No Lifecycle Hooks Beyond `onAttach()`

Components have `onAttach()` and `update()` but no `onDetach()`, `onDestroy()`, `onEnable()`, or `onDisable()`. Components can't clean up resources, unsubscribe from events, or react to being disabled.

This will become critical when:
- Components hold references to external resources (audio handles, subscriptions)
- Nodes are destroyed and components need to release handles
- The enabled flag is toggled and components need to suspend/resume logic

### 6. `traversePreOrder()` Allocates a New Array Every Frame

`state_tree`'s `traversePreOrder()` creates a new `TreeNode[]` every call. At 60fps, that's 60 array allocations per second — each potentially triggering GC on mobile. For `flat_tree`, the recommendation is to use an iterative stack-based traversal with a reusable buffer:

```typescript
private _traversalStack: number[] = [];

traversePreOrder(): number[] {
    const result: number[] = [];
    this._traversalStack.length = 0;
    this._traversalStack.push(ROOT_ID);
    // ... iterative walk
}
```

Or better yet, use a visitor/callback pattern that avoids allocating a result array entirely.

### 7. The Component System Design Is the Hardest Problem Ahead

The `state_tree` component system uses class instances stored in arrays on each node. This is an object-graph pattern. In `flat_tree`, you have two options:

**Option A: Class instances in a parallel `Map<number, Component[]>`**  
Easy to implement, preserves the existing `Component` API. But defeats the purpose of DOD — traversal over components still chases heap pointers. The tree is flat but the gameplay data isn't.

**Option B: Component data in typed arrays**  
True DOD — a `Float32Array(capacity)` for each component field (health, position.x, position.y, etc.). Maximum cache locality. But this requires a Component Registry that knows the data layout at initialization time, and user-defined components need a schema system instead of free-form classes.

**Option C: Archetype-based storage (Bevy/Unity DOTS)**  
Groups entities by their component composition. Entities with the same set of component types are stored contiguously. Most cache-efficient for System-style queries ("iterate all entities with Health and Position"). But significantly more complex to implement.

For the immediate goal (get games running on Reanimated), Option A is pragmatic. For the long-term goal (maximum performance on mobile), Option B or C is necessary. This decision will determine the entire DX of the engine.

### 8. Fixed Capacity With No Growth Strategy

`FlatTreeStorage` has a fixed capacity set at construction. If a game spawns more entities than allocated, it crashes. There's no automatic growth, no "double and copy" fallback, and no way to resize.

For a game engine, this means:
- Over-allocate → waste memory on mobile (8 arrays × capacity × 4 bytes)
- Under-allocate → crash at runtime
- Dynamic scenarios (bullet hell, particle systems) are risky

Options:
- **Accept the constraint** — require users to predict peak entity count (common in console games)
- **Auto-grow** — when capacity is hit, allocate new larger arrays and copy (simple, occasional GC hit)
- **Chunked allocation** — allocate in fixed-size chunks, link them (avoids copy, more complex iteration)

### 9. `state_tree` and `flat_tree` Will Diverge Further

Right now, `state_tree` serves as both the reference implementation and the behavioral spec. But as `flat_tree` evolves — especially around components and traversal — the two implementations will necessarily diverge. `flat_tree` can't support class-based components on worklet threads. `flat_tree` can't use string IDs. The API surfaces are already different (`attach(parent, child)` vs `attach(child, parent)` argument order).

At some point, `state_tree` will stop being useful as a reference and become dead code. Plan for this: either keep it explicitly as a test oracle (run both implementations against the same test cases), or sunset it once `flat_tree` is stable.

> [!NOTE]
> The `attach` argument order is already reversed between the two implementations: `state_tree` uses `attach(parent, child)` while `flat_tree` uses `attach(child, parent)`. This is a minor inconsistency that could cause confusion if someone references one implementation while working on the other.

### 10. Reanimated Integration Is the Real Architectural Test

Everything built so far is pure TypeScript. The real constraints arrive when you try to run this on a Reanimated worklet thread:

- **Data must be `SharedValue` or `SharedArrayBuffer`** — can't just pass `Int32Array` across the bridge. The storage arrays need to be backed by shared memory.
- **Worklet functions are restrictive** — no closures over complex objects, no arbitrary imports. User `update()` logic must be worklet-compatible.
- **Cross-thread communication** — input events, audio triggers, and heavy logic need `runOnJS()` escape hatches. The `CommandBuffer` pattern will need a cross-thread variant.
- **Component data on the worklet thread** — class instances can't be shared. Component data must be in flat arrays (typed arrays or `SharedValue`s).

The `flat_tree` architecture is correctly aligned for this — `Int32Array` buffers are the right foundation. But the integration layer will require significant design work that can't be prototyped in pure TypeScript.

---

## Architectural Insights Worth Preserving

These are key learnings from the development process that should inform future decisions:

### The Stale Reference Problem

In a flat-array architecture with slot reuse, integer IDs become dangling pointers. `FlatNodeRef(id=5, version=1)` solving this via generational indices is not just a nice-to-have — it prevents an entire class of "silent corruption" bugs that are nearly impossible to debug in a game running at 60fps.

### The Façade Pattern for DOD + OOP

The user should never touch raw arrays. Every interaction should go through `FlatWorld` (for mutations) or `FlatNodeRef` (for property access). The implementation should feel like OOP while being DOD underneath. This is the same approach Unity DOTS, browser DOM APIs, and GPU driver APIs use.

### On-the-Fly Reference Creation

`getParent()` and `getChildren()` create new `FlatNodeRef` instances each call. This means `node.getParent() === node.getParent()` is `false`. The `equals()` method handles logical equality. This is a conscious tradeoff — the alternative (caching refs) creates stale-reference hazards and memory leaks.

### Reanimated Compatibility Requires SoA

`Int32Array` buffers can be shared across thread boundaries via `SharedArrayBuffer` or Reanimated's `SharedValue`. Object graphs (like `state_tree`) cannot be shared across the bridge without serialization. The entire motivation for `flat_tree` is Reanimated compatibility — the performance benefits are a bonus.

### CommandBuffer Is Essential, Not Optional

The deferred mutation pattern is not a "nice to have." Without it, any component that creates or destroys nodes during its `update()` will corrupt the traversal iterator. This must be implemented for `flat_tree` before the update loop can work.

---

## Summary

The architecture is sound and well-motivated. The core abstractions — SoA storage, generational indices, doubly-linked sibling lists, the Façade pattern — are borrowed from established high-performance game engines and applied correctly. The test suite is thorough and organized.

The immediate work (destroy + reparent) is straightforward — the linked-list operations are well-understood, and `state_tree` provides a clear behavioral spec. The real architectural challenges are ahead: the component system design, the Reanimated integration, and the growth strategy for fixed-capacity storage. These will require deliberate design decisions, not just implementation work.
