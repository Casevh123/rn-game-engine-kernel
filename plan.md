# Plan

> Current state. What's next. What's deferred.
> Last updated: 2026-05-12

---

## Done

- **Tree**: create, attach, detach, destroy (iterative post-order subtree), reparent (cycle detection)
- **Storage**: SoA allocator, free-list, generational indices, doubly-linked siblings
- **Components**: Dense pools, swap-and-pop, pool registry, automatic cleanup on destroy
- **Facade**: FlatWorld + FlatNodeRef with ownership + liveness validation
- **Execution model**: System type, CommandBuffer (deferred structural mutations), World.step(dt)
- **Proof**: Movement system (PositionPool + VelocityPool + movementSystem) demonstrating end-to-end frame loop
- **Transforms**: RSXform storage columns (4 floats per transform: sCosθ, sSinθ, tx, ty), local + world per node, transform propagation system (iterative pre-order tree walk), disabled subtree skipping, convenience accessors (setLocalTransform, getLocalTransform, setLocalPosition, getWorldTransform)
- **Transform proof**: Movement system writes localTx/localTy → propagation computes world transforms → child tracks parent motion across frames. Reparent, destroy, and disable/re-enable all verified end-to-end.
- **Tests**: ~196 tests across storage, world, destroy/reparent, component pools, command buffer, step, transforms, and integration
- **Archived**: `state_tree` (original OOP prototype, served as behavioral reference, now superseded by flat_tree)
- **Axiom 9 enforcement**: Runtime guards on `destroy()`, `attach()`, `detach()`, `reparent()` — throw during `step()`
- **Crash recovery**: System throw clears command buffer (atomic frame semantics), world remains usable

---

## Next: User-Facing API Design

The kernel is functionally complete — tree, components, execution model, and transforms are implemented and tested. The next architectural milestone is designing the user-facing layer that sits on top of the kernel.

### Open questions (must answer before implementing)

**What does the user API look like?**
Users should not write raw systems. The target is Godot/Unity-style per-node scripts with lifecycle hooks (`onReady`, `onUpdate`, `onPhysicsUpdate`, `onDestroy`). Under the hood, a `ScriptExecutionSystem` (engine system) iterates all nodes with scripts and calls their hooks. Design the hook surface.

**Frame loop pipeline ordering?**
With engine systems (transform propagation, future physics, render collection) AND user scripts, the frame ordering becomes non-trivial. If a user script reads world positions, transforms must propagate first. If a script moves entities, transforms must propagate again. Double-propagation per frame? Accept one-frame latency? Fixed pipeline stages?

**React reconciler?**
The kernel already has the right primitives for a custom React reconciler (`createNode` → `createElement`, `attach` → `appendChild`, etc.). Is this the right time to build it, or does it depend on the user API design?

**Engine system auto-registration?**
Transform propagation should be automatic — the user shouldn't manually call `addSystem()` for engine systems. Design the boundary between engine systems (automatic, internal) and user systems (registered, or expressed as scripts).

**Component registration lifecycle?**
Can components be added at runtime? (Pool system supports it.) Should the API be declarative (React reconciler handles it) or imperative (scripts call `addComponent()`)? Or both?

---

## Deferred

| Feature | Why deferred |
|---|---|
| Reanimated integration | Requires backend decision. SoA layout is compatible — defer until core loop works. |
| C++ native module | 4-8 week effort. Behavioral spec must be complete first — it IS the port's design doc. |
| Physics | A system that runs on the component model. Needs transforms (done) and user API design. |
| Input | Command source, not a core engine feature. Wire after command bus exists. |
| Rendering | Requires Skia integration. Rendering architecture is researched (RSXform → Atlas pipeline). Separate layer on top of the kernel. |
| Auto-grow storage | Intentionally deferred. Fixed capacity is simpler and avoids GC. Revisit if it becomes a real constraint. |
| Builder/spawn API | Ergonomic wrapper over create + add components + attach. Build after core stabilizes. |
