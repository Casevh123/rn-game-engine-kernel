# Plan

> Current state. What's next. What's deferred.
> Last updated: 2026-05-05

---

## Done

- **Tree**: create, attach, detach, destroy (recursive subtree), reparent (cycle detection)
- **Storage**: SoA allocator, free-list, generational indices, doubly-linked siblings
- **Components**: Dense pools, swap-and-pop, pool registry, automatic cleanup on destroy
- **Facade**: FlatWorld + FlatNodeRef with ownership + liveness validation
- **Tests**: ~100 flat_tree tests across storage, world, destroy/reparent, component pools

---

## Next: Systems and Update Loop Design

The component pools are the data layer. What's missing is the **execution model** — the thing that reads and writes component data each frame.

### Open questions (must answer before implementing)

**What is a system?**
A function? A class? Does it declare which pools it reads/writes? Is it a `(pools, dt) => void` signature, or something more structured? This determines the entire DX of the engine.

**Who needs pre-order traversal?**
In `state_tree`, traversal existed to call `component.update()`. In `flat_tree`, components are data — systems iterate pools, not trees. Tree traversal matters for transform propagation and rendering order, but most systems (movement, health, collision) don't care about parent-child relationships. Traversal may be one specific system, not the backbone of the loop.

**What does the update loop orchestrate?**
`state_tree`: traverse → update components → flush commands. `flat_tree` likely: run systems (each iterates its own pools) → flush commands. The loop is a system scheduler, not a tree walker.

**Does the command bus change shape?**
Systems that create/destroy nodes during iteration need deferred mutations. Same pattern as `state_tree`, but the trigger is different — systems flush at phase boundaries, not after a tree walk.

### After design is locked

1. Implement whatever traversal/iteration the system model requires
2. Implement FlatCommandBus (deferred mutations)
3. Implement the update loop (system scheduler)
4. Write one concrete system (e.g. MovementSystem: reads Position + Velocity pools) as proof

---

## Deferred

| Feature | Why deferred |
|---|---|
| Reanimated integration | Requires backend decision. SoA layout is compatible — defer until core loop works. |
| C++ native module | 4-8 week effort. Behavioral spec must be complete first — it IS the port's design doc. |
| Physics | A system that runs on the component model. Build the model first. |
| Input | Command source, not a core engine feature. Wire after command bus exists. |
| Rendering | Requires Skia integration. Separate layer on top of the kernel. |
| Auto-grow storage | Intentionally deferred. Fixed capacity is simpler and avoids GC. Revisit if it becomes a real constraint. |
| `state_tree` archival | Still useful as behavioral reference for command bus. Archive after flat_tree has feature parity. |
