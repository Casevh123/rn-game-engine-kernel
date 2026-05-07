# Plan

> Current state. What's next. What's deferred.
> Last updated: 2026-05-07

---

## Done

- **Tree**: create, attach, detach, destroy (iterative post-order subtree), reparent (cycle detection)
- **Storage**: SoA allocator, free-list, generational indices, doubly-linked siblings
- **Components**: Dense pools, swap-and-pop, pool registry, automatic cleanup on destroy
- **Facade**: FlatWorld + FlatNodeRef with ownership + liveness validation
- **Execution model**: System type, CommandBuffer (deferred structural mutations), World.step(dt)
- **Proof**: Movement system (PositionPool + VelocityPool + movementSystem) demonstrating end-to-end frame loop
- **Tests**: ~138 tests across storage, world, destroy/reparent, component pools, command buffer, step, and integration
- **Archived**: `state_tree` (original OOP prototype, served as behavioral reference, now superseded by flat_tree)
- **Axiom 9 enforcement**: Runtime guards on `destroy()`, `attach()`, `detach()`, `reparent()` — throw during `step()`
- **Crash recovery**: System throw clears command buffer (atomic frame semantics), world remains usable

---

## Next: Transform Propagation

The frame loop works. The first system that *needs* the tree is transform propagation — computing world transforms from local transforms via a pre-order tree walk.

### Open questions (must answer before implementing)

**What are transforms?**
2D only? Position + rotation + scale? 3×3 matrix? `Float32Array` columns like position pools, or a dedicated layout? This affects the pool design and the propagation math.

**Does every node have a transform?**
Or only nodes that opt in via a TransformPool component? If every node has one, it could be a storage column (like `enabled`) rather than a pool.

**Enabled inheritance?**
Does `node.enabled = false` disable the subtree? If yes, transform propagation should skip disabled subtrees. Needs to be decided before the traversal system is written.

**Can physics write transforms?**
If a physics body's world position is authoritative, how does that reconcile with the tree's local→world propagation? Does physics write to WorldTransform directly, bypassing local? Or does it write LocalTransform and let propagation compute world?

### After design is locked

1. Implement iterative pre-order tree traversal (explicit stack, not recursion)
2. Implement LocalTransform + WorldTransform pools (or storage columns)
3. Implement transformPropagationSystem
4. Prove: parent moves → child's world transform updates

---

## Deferred

| Feature | Why deferred |
|---|---|
| Reanimated integration | Requires backend decision. SoA layout is compatible — defer until core loop works. |
| C++ native module | 4-8 week effort. Behavioral spec must be complete first — it IS the port's design doc. |
| Physics | A system that runs on the component model. Needs transforms first. |
| Input | Command source, not a core engine feature. Wire after command bus exists. |
| Rendering | Requires Skia integration. Separate layer on top of the kernel. |
| Auto-grow storage | Intentionally deferred. Fixed capacity is simpler and avoids GC. Revisit if it becomes a real constraint. |
| User scripting | Facade layer on top of the system model. Design after engine systems prove the model. |
| Builder/spawn API | Ergonomic wrapper over create + add components + attach. Build after core stabilizes. |
