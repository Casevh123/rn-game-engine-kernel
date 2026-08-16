# TODO — The Sequence

> Read [plan.md](plan.md) for direction. This file is the order of operations.
> Phases are sequential; tasks within a phase are ordered. Effort: S (< half day) · M (1–3 days) · L (a week+).
> Grounded in a full code audit (kernel source, demo, react-native package, all 13 test files) on 2026-07-01.

**Definition of done ("visible"):** public repo · README with a demo video and honest benchmarks · GETTING_STARTED that works in a fresh Expo app · a real playable sample game built on the public API. Everything below sequences backward from that.

---

## Phase 0 — Stabilize what exists (S total)

- [x] **0.1 Commit the `attach()` cycle-check fix** already sitting in the working tree (`FlatWorld.ts`). It closes a real hole: a detached subtree's root could be attached to its own descendant. 257 tests green with it. Add the missing test: build A→B, detach A, `attach(A, B)` must throw.
- [x] **0.2 Add `'worklet'` directives to the input layer** — `beginInputFrame.ts`, `endInputFrame.ts`, `touchAccumulator.ts`, `TouchState.ts`, `touchProducerInterface.ts`: the factories AND the returned systems/closures. Kernel convention (commit `c5b88ba`) requires them on every function; these five files postdate that commit and have none. Jest can't catch this (directives are no-ops there); on-device it fails at serialization. (S)
- [x] **0.3 Export the input layer from `packages/kernel/src/index.ts`.** `createTouchAccumulator`, `createTouchState`, `createBeginInputFrame`, `createEndInputFrame`, `writeTouchDown/Move/Up/Cancel`, `findInBuffer`, types `TouchInputAccumulator`/`TouchState`, and `MAX_TOUCHES`. Today the entire input system is unreachable from `@engine/kernel`. (S)
- [x] **0.4 Fix the `free()` invariant violation** — `FlatTreeStorage.ts:92-93` resets dead slots to `enabled=1, worldEnabled=1`, contradicting the NewWorldInvariant ("freshly allocated nodes are worldDisabled"). `allocate()` masks it today, but any future id-range scan that forgets to check `alive` reads dead slots as world-enabled. Make `allocate()` the single reset point; `free()` only kills and relinks. Add a test asserting freed-slot state. Deletes the redundant double-reset flagged in the old engine diff. (S)

## Phase 1 — Correctness by construction (kernel debt that gates everything above it)

The theme: the framework's promise to users is *correct by construction, not correct if you're careful*. These are breaking changes — cheapest now, before the RN layer and sample game are built on top.

- [ ] **1.1 Multi-column component pools — the structural fix. (L)**
  - Problem: the swap-and-pop callback swaps only the columns its author remembered. `SpritePool` swaps only `spriteType`; the demo previously desynced `vx/vy/px/py` on any non-tail removal and survived *by accident* (it only destroyed the newest sprite — a no-op swap). Fixed in the demo 2026-08-06 by hand-swapping all five columns, but the API still lets the next user make the original mistake.
  - Change: components register their TypedArray columns with the pool (a column descriptor); the pool generates the swap over all of them. Hand-written swap callbacks cease to exist in the public API.
  - Acceptance: a test removing a *middle* element from a pool with ≥ 2 columns asserts no desync; `SpritePool` and the demo (already on `createComponentPool` with a full manual swap) migrated; the "your swap callback must swap ALL your arrays" warning in GETTING_STARTED becomes obsolete and is deleted.
- [ ] **1.2 Guard component/node mutation during `step()`. (M)**
  - `pool.add/remove` and `createNode()` are unguarded mid-step (GETTING_STARTED currently *recommends* them). A `pool.add` inside a system mutates the dense array being iterated.
  - Recommendation: throw like the structural ops (consistent with Axiom 9) and extend the CommandBuffer with `spawn`/`addComponent`/`removeComponent` ops so systems still have a path.
  - Acceptance: a test per guarded op during step; demo spawning migrated; GETTING_STARTED "Key rules" rewritten.
- [ ] **1.3 Define command-buffer flush semantics. (M)**
  - Today, a queued command that throws mid-flush (ordinary case: two systems both queue `destroy` of the same node — the second hits a stale ref) drops the rest of the batch and the exception escapes `step()`.
  - Decide and enforce: `destroy` on an already-dead ref is a no-op (idempotent destroy); other structural ops on dead refs are skipped (or logged). Flush must complete the batch.
  - Acceptance: the two-systems-destroy-same-node test; a mid-batch-survivor test.
- [ ] **1.4 Frame-loop allocation hygiene — cheap wins only. (S–M)**
  - Not chasing zero-GC (see plan.md); removing the *every-frame* allocations: preallocated scratch stack (Int32Array + top pointer) for transform propagation and `_destroySubtree`; scalar transform accessors (`getWorldTx(ref)`-style) for use inside systems so the `{a,b,tx,ty}` object return stays out of hot loops.
  - Acceptance: no `[]`/object allocation in per-frame system code paths; measured later in 6.1, reported honestly.

## Phase 2 — Input becomes a feature, not plumbing (kernel)

- [ ] **2.1 Touch query layer. (M)** Pure functions over `TouchState`: `getTouchDelta`, `getTouchDragFromStart`, `getTouchVelocity`, `getTouchDuration`, `isTap`, `isDrag(threshold)`. Jest-tested against the TouchSpec invariants (delta contract, one-frame visibility of ended touches). Scope = what the sample game needs; pinch/long-press deferred until pulled. Update [TouchSpec.md](packages/kernel/working_docs/TouchSpec.md) as the contract grows.
- [ ] **2.2 Decide the hit-test story. (S)** Screen→world requires the camera (4.1). Decide now, build then: `screenToWorld(camera, x, y)` + a world-space point/AABB hit helper. Document the decision in plan.md.

## Phase 3 — The vertical slice: `@engine/react-native` becomes real (L)

This is the product surface, and today it is one re-export line. Biggest gap between "kernel" and "framework."

- [ ] **3.1 `useEngine(setup)`** — owns world creation on the UI thread, keyed replacement on Fast Refresh, disposal on unmount. Kills the current landmine: the demo bootstraps inside `useFrameCallback` onto `globalThis` with no teardown, so every remount/HMR orphans an engine.
- [ ] **3.2 `<EngineCanvas>`** — Canvas + Atlas + `useRSXformBuffer`/`useRectBuffer` wiring from a `RenderBuffer` + atlas descriptor (extract the pattern from `apps/demo/GameScreen.tsx:310-361`).
- [ ] **3.3 `useTouchBridge`** — `GestureDetector` + `Gesture.Manual()` → `writeTouch*` into the `TouchInputAccumulator`. The on-device proof of the input pipe landed 2026-08-06 (hand-wired in the demo: finger-as-collider through the full pipeline); this task extracts that wiring into the package hook.
- [ ] **3.4 Frame-loop contract** — `beginInputFrame → user systems → transformPropagation → renderCollection → endInputFrame`, with a dt clamp (~33ms cap) so hitches don't explode physics. Interim answer until the fixed-timestep decision.
- [ ] **3.5 Rewrite the demo on the new package.** Acceptance: `GameScreen.tsx` contains game logic only — zero direct `globalThis`/Skia/gesture wiring; Fast Refresh doesn't orphan engines; add one touch interaction (drag/flick) proving input end-to-end on device.
- [ ] **3.6 Rewrite `packages/react-native/SPEC.md` from the implementation** (it currently specs by aspiration).

## Phase 4 — Minimum real-game features (pulled by the sample, never pushed)

- [ ] **4.0 Pick the flagship sample game FIRST. (S)** One screen, complete, juicy — e.g. asteroid-dodge / breakout / flappy-class. Its needs set the scope of 4.1–4.4. Write a one-page game spec.
- [ ] **4.1 Camera. (M)** View transform applied in render collection (inverse camera compose — same RSXform math), plus `screenToWorld`. Unlocks touch-in-world; nearly every game needs it.
- [ ] **4.2 Z-ordering. (M)** Pool order is scrambled by swap-and-pop *by design*, so draw order is currently undefined. Sort key column; sort an index array in the gather (counting sort by layer keeps it linear); data stays put.
- [ ] **4.3 Sprite animation system (M — only if the sample needs it).** Frame-advance over atlas indices; an AnimationPool on the multi-column pools from 1.1.
- [ ] **4.4 Whatever else the sample pulls.** (Score/UI text = React overlay, not engine text. Engine text stays deferred.)

## Phase 5 — Flagship sample game (L)

Build it exclusively through the public API (`@engine/react-native` + `@engine/kernel`). This is the DX audit: every papercut is a framework bug — log it, fix it, continue. Acceptance: a stranger clones, runs, plays; the game feels good; the source reads as an advertisement for the API.

## Phase 6 — Visibility (a deliverable with acceptance criteria, not a hope)

- [ ] **6.1 Benchmark suite. (M)**
  - `step()` time vs N (100/500/1k/2k/5k), collision ON vs OFF — isolates the O(n²) demo physics from engine core cost.
  - Bytes allocated per `step()` at fixed N — report the honest number, whatever it is.
  - The legible one: the same bouncing-sprite scene in (a) RN `Animated`, (b) naive per-sprite Skia components, (c) this engine. "Holds Nk sprites where the naive path dies at N hundred" is the artifact a non-engine person understands.
- [ ] **6.2 README rebuild. (S–M)** 20-second video/gif at the top, working quick start, honest perf table, the architecture story (UI-thread runtime decision, SoA, invariants), links to sample game.
- [ ] **6.3 GETTING_STARTED verified end-to-end** in a fresh Expo app *outside* the monorepo. Decide distribution: npm publish vs git install. Fix everything that breaks.
- [ ] **6.4 Public repo + writeup. (M)** Devlog/blog: the runtime-target decision, invariant-driven development (the worldEnabled transition matrix is genuinely good content), what SoA buys on a phone, honest benchmarks. This is the piece recruiters and interviewers actually read. Invisible work scores zero.

---

## Deferred — named, with triggers

| Feature | Trigger to build it |
|---|---|
| Multi-component queries (sparse-set intersection) | First sample-game system that needs "entities with A **and** B" |
| Dirty-flag transform propagation | Benchmarks (6.1) show whole-tree propagation matters at target N |
| Fixed timestep + render interpolation | Physics reproducibility matters (dt clamp in 3.4 is the interim) |
| React reconciler scene API | Imperative API first; revisit only after the sample game ships |
| Non-uniform scale / full 2×3 affine columns | A game needs squash-and-stretch |
| Spatial partition (collision broadphase) | A sample needs > ~1k colliders |
| Multi-atlas pages, engine text, particles, sound events | Post-visibility |
| Zero-alloc `step()` as a headline | Permanently demoted: measured and reported honestly (6.1), chipped at opportunistically (1.4) |

## Ordering logic

Phase 1 precedes everything user-facing because pool semantics are a **breaking change** — every later layer (RN bridge, sample game, docs) is built on top of them, and the correct-by-construction guarantee is the product promise. Input (2) precedes the RN layer (3) because the bridge needs something to bridge. The RN layer precedes features (4) because it's the vertical gap — the difference between "a kernel" and "a framework." Features are pulled by the sample (5), never speculatively pushed. Visibility (6) is last in sequence but is *the* milestone the clock points at — start 6.4's writeup notes early; the material accumulates in every phase.
