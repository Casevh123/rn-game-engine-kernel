# Plan

> Product direction and true current state. The task sequence lives in [todo.md](todo.md).
> Last updated: 2026-07-01 — after a full code audit (kernel, demo, react-native package, all tests).

---

## What This Product Is

**A framework other developers use to ship 2D games in React Native.** The product is the framework — not the games made with it, and not the demo. The kernel is the core, but the product surface is `@engine/react-native` plus the developer experience: install it, follow GETTING_STARTED, ship a game.

Everything is judged against that: a feature that makes the engine more impressive but the framework harder to use loses to one that makes shipping a game easier.

### The clock

This project must be **vertically finished and publicly visible** in time to carry weight for the 2028 internship cycle (recruiting opens ~fall 2027). Implications:

- **Vertical beats horizontal.** A complete path — kernel → RN bridge → playable sample game → public README with video — beats any additional kernel sophistication.
- **Honest beats bold.** Performance claims are measured and reported, not asserted. "Zero-GC" is explicitly demoted from headline to hygiene: per-frame allocations get cheap fixes and an honest benchmark number, nothing more.
- **Standards are not negotiable.** Invariant-first design, exhaustive tests, correct-by-construction APIs. The clock changes *what* gets built (vertical slice), never *how well*.

---

## Runtime Model (unchanged, validated)

The kernel runs on the **UI worklet thread** (react-native-reanimated). Gesture input, `world.step()`, and Skia `<Atlas>` rendering share one thread — no bridge, no serialization, no transport problem. Full rationale: [docs/runtime_target_change.md](docs/runtime_target_change.md).

| Concern | Technology | Thread |
|---|---|---|
| Engine kernel | `@engine/kernel` (pure TS, closure factories) | UI worklet thread |
| Frame loop | `useFrameCallback` | UI worklet thread |
| Rendering | `<Atlas>` + RSXform buffers (react-native-skia) | UI thread |
| Input | `Gesture.Manual()` (gesture-handler) | UI thread |
| Scene declaration & UI | React | JS thread |

**Named ceiling:** everything shares the 16.6ms frame budget with rendering. There is no escape hatch to a worker thread by design; the wall is quadratic user systems (the demo's O(n²) collision is ~4ms at 500 sprites and explodes beyond). This is a deliberate constraint, stated openly — not an oversight.

Other deliberate constraints: fixed world capacity (no paging/growth), uniform-scale-only transforms (RSXform `(a,b,tx,ty)`, no shear/non-uniform scale), single atlas page. Each has a named trigger in [todo.md](todo.md#deferred--named-with-triggers) if a real game pulls it.

---

## True Current State (audited 2026-07-01)

### Kernel — solid core, known debts

**Built and tested (258 tests, 13 suites):** SoA storage with intrusive free-list · generational handles · scene graph with O(1) attach/detach/reparent and iterative destroy · worldEnabled invariant (enabled ∧ ancestors-enabled ∧ root-reachable, per [NewWorldInvariant.md](packages/kernel/NewWorldInvariant.md)) enforced across all mutations · sparse-set component pools with swap-and-pop · deferred command buffer with step guards · RSXform transform propagation · atlas-aware render collection with pivot correction · two-buffer touch input (raw `TouchEventBuffer` → cooked `TouchState`, begin/end frame systems, per [TouchSpec.md](packages/kernel/TouchSpec.md)).

**Known debts (Phase 0–1 of todo.md):**
- Component pools swap only the columns their author remembered — parallel user columns silently desync on non-tail removal. The single latent-corruption bug in the design.
- `pool.add/remove` and `createNode` unguarded during `step()`.
- A queued command throwing mid-flush drops the rest of the batch.
- Input files missing `'worklet'` directives and **not exported** from the package at all.
- `free()` resets dead slots to enabled/world-enabled, contradicting the invariant.
- Per-frame allocations in traversal stacks and accessors (hygiene, not headline).

### Input — plumbing built, feature missing

The event pipeline exists and is well-tested (54 tests). What a game developer actually calls — delta/velocity/tap/drag queries — does not exist yet, and no RN bridge wires gestures in.

### `@engine/react-native` — **empty**

One re-export line plus TODO comments. This is the largest gap between "kernel" and "framework," and the core of the vertical slice (todo Phase 3): `useEngine` lifecycle (with disposal — the current demo bootstrap orphans engines on `globalThis` across Fast Refresh), `<EngineCanvas>`, `useTouchBridge`, frame-loop contract.

### Demo — works, hand-wired, two landmines

500 sprites at 60fps with gravity + O(n²) collision + perf overlay on device. But: it survives the pool-desync bug only because it always destroys the newest sprite (a no-op swap); and it has no teardown. It becomes the first consumer of `@engine/react-native` in Phase 3, then is superseded as the showcase by the flagship sample game (Phase 5).

### Documentation — consolidated as of this date

ENGINE_DIFF.md (AI-generated review scaffolding) has been deleted; its verified findings live in todo.md Phases 0–1 and 6, its deferred items in the trigger table. README, GETTING_STARTED, and the react-native SPEC have been corrected against the code.

**Doc map — what is authoritative for what:**

| Question | Source of truth |
|---|---|
| Product direction, current state | this file |
| What to do next, in order | [todo.md](todo.md) |
| Kernel model, axioms, contracts | [packages/kernel/SPEC.md](packages/kernel/SPEC.md) |
| worldEnabled invariant | [packages/kernel/NewWorldInvariant.md](packages/kernel/NewWorldInvariant.md) |
| Touch input contract | [packages/kernel/TouchSpec.md](packages/kernel/TouchSpec.md) |
| RN bridge contracts | [packages/react-native/SPEC.md](packages/react-native/SPEC.md) (rewrite scheduled, todo 3.6) |
| Historical decisions | [docs/](docs/) |

---

## Open Decisions

| Decision | Context | When |
|---|---|---|
| Flagship sample game choice | Sets the scope of Phase 4 features | Start of Phase 4 (todo 4.0) |
| Camera representation | Dedicated node vs storage column vs render-time offset | Before todo 4.1 |
| Z-order key | Layer component vs y-sort vs tree order | Before todo 4.2 |
| Step-mutation guard mechanism | Throw + command-buffer ops vs assert-only | todo 1.2 |
| Flush failure semantics | Idempotent destroy + skip-stale vs validate-then-apply | todo 1.3 |
| Distribution | npm publish vs git install | Before todo 6.3 |
| Fixed vs variable timestep | dt clamp is the interim answer | When physics reproducibility matters |

## Resolved Decisions

| Decision | Resolution |
|---|---|
| Runtime target | UI worklet thread (not worker) — [docs/runtime_target_change.md](docs/runtime_target_change.md) |
| Kernel architecture | Closure factories, zero classes (worklet serialization) |
| Storage | SoA TypedArray columns, fixed capacity, intrusive free-list |
| Transforms | RSXform `(a,b,tx,ty)`, trig-free composition, 1:1 with Skia |
| worldEnabled semantics | enabled ∧ all-ancestors-enabled ∧ root-reachable ([NewWorldInvariant.md](packages/kernel/NewWorldInvariant.md)) |
| Input design | Two-buffer: raw event buffer (producer-written) → cooked per-frame state, begin/end bookend systems, per-frame boolean phase flags (not a phase enum) |
| React scene API | Imperative first; reconciler deferred until after the sample game ships |
| Zero-GC | Demoted from headline claim to measured hygiene |
| Render buffer format | Parallel Float32Array transforms + Int32Array spriteTypes, contiguous 0..count |
| Packaging | npm workspaces monorepo |
