# Runtime Target Change — Worker Worklet → UI Worklet

**Date:** 2026-05-15
**Status:** Decision made, docs not yet updated

---

## The Two Worklet Runtimes

`react-native-worklets` distinguishes two runtime types:

| Runtime | How you get it | Thread | Purpose |
|---|---|---|---|
| **UI worklet runtime** | Exists by default. Code runs via `'worklet'` directive in hooks like `useFrameCallback`, `useAnimatedStyle`, `useRSXformBuffer` | UI thread (main thread) | Animations, rendering callbacks, gesture handlers |
| **Worker worklet runtime** | Created explicitly via `createWorkletRuntime(name, init)` | Ambiguous background thread | Offloading computation from UI thread |

## Previous Target: Worker Worklet (Background Thread)

The kernel was designed to run on a **worker worklet runtime** created via `createWorkletRuntime`. The A3 audit proved this works (18/18 checks). The architecture assumed:

- Kernel runs on a dedicated background thread
- Render data crosses to the UI thread via SharedValue (v0) or native buffer (v1+)
- Input data crosses from UI thread to kernel thread via SharedValue snapshots
- **Cross-thread communication is inherently async**

## New Target: UI Worklet Runtime (UI Thread)

The kernel now targets the **default UI worklet runtime** — the same thread where:

- Skia rendering hooks execute (`useRSXformBuffer`, `useFrameCallback`)
- Gesture handlers fire (react-native-gesture-handler)

### Why

1. **Synchronous rendering path**: Kernel output (RenderBuffer) is consumed by Skia hooks on the same thread — no cross-thread serialization, no SharedValue cloning, no frame-of-latency delay.
2. **Synchronous input path**: Gesture data lands on the UI thread. If the kernel lives there too, it reads input directly — no async snapshot needed.
3. **Eliminates the transport problem entirely for v0**: No SharedValue throughput ceiling, no triple-buffering, no Nitro module dependency.
4. **Simpler ergonomics**: No `createWorkletRuntime` call, no init function. Engine bootstraps via `globalThis` storage, frame loop driven by `useFrameCallback`.

### What changes

| Concern | Before (worker worklet) | After (UI worklet) |
|---|---|---|
| Kernel thread | Dedicated background thread via `createWorkletRuntime` | UI thread (default worklet runtime) |
| Frame driver | `setInterval` / `setTimeout` on worker thread | `useFrameCallback` (Skia's frame loop) |
| Kernel ↔ renderer | Cross-thread SharedValue | Same-thread `globalThis` read |
| Input ↔ kernel | Cross-thread SharedValue snapshot | Same-thread direct read |
| Initialization | `createWorkletRuntime(name, initFn)` — init function bootstraps world | No init function. Engine created inline in a worklet callback, stored on `globalThis` |
| `createWorkletRuntime` | Required | Not used |

### What does NOT change

- The kernel code itself (factories, SoA storage, systems, command buffer)
- The closure-factory architecture (still needed — worklet serialization still strips prototypes)
- `'worklet'` directives (still needed for Babel plugin to serialize functions into UI worklet context)
- All 182 kernel tests (runtime-agnostic)

## Open Questions

- **`globalThis` on UI worklet**: Can we store the engine instance on `globalThis` and have it persist across frames? (Likely yes — worker worklet `globalThis` worked in A3.)
- **`useRSXformBuffer` reactivity**: Does mutating a `SharedValue` that `useRSXformBuffer` reads cause it to re-run synchronously on the same frame? Or is there a one-frame delay?
- **Frame budget**: The kernel now competes with rendering for UI thread time. Need to measure whether `world.step(dt)` fits within the ~16ms frame budget alongside Skia draw calls.

## Docs That Need Updating

- `spec.md` — line 5 references `createWorkletRuntime`
- `plan.md` — Runtime Target table (lines 26–36), v0 description, v1 Nitro rationale
- `README.md` — Runtime Model diagram, architecture description
- `a3_audit_report.md` — implications section (worker runtime no longer the target, but audit still valid for proving serialization)
