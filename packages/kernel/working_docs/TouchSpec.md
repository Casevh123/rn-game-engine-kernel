# Touch Input Contract

> The implemented kernel-side input design. Enforced by `__tests__/input-system.test.ts` (54 tests).
> Source: `touchBuffer.ts`, `TouchState.ts`, `beginInputFrame.ts`, `endInputFrame.ts`, `touchProducerInterface.ts`.

## Two buffers

**TouchEventBuffer** — the producer (gesture side) writes raw facts via `writeTouchDown/Move/Up/Cancel`; the kernel clears after consumption. Phase is per-frame boolean event flags (`beganThisFrame`, `movedThisFrame`, `endedThisFrame`, `canceledThisFrame`), not a phase enum.

**TouchState** — the kernel writes a normalized frame snapshot in `beginInputFrame`; gameplay systems read this only. Carries current position, start position/time, previous-frame position, visibility.

Goal: deterministic touch behavior — gameplay sees one consistent snapshot per frame regardless of how events arrived between frames.

## Invariants

- **Delta contract:** `prevX/prevY` hold the position at the previous engine read boundary. If a touch both began and moved between two frames, its first-frame delta is 0 (drag-from-start still measures from `startX/startY`).
- **Time contract:** `startTime` is the world time of the first engine read of the touch, not the OS event time.
- **ID invariant:** ids are non-negative; `touchId = -1` means empty slot. The consumer (`endInputFrame`) is responsible for slot cleanup in the buffer.
- **Visibility invariant:** ended/cancelled touches are visible for exactly one frame (their final flags readable by game systems that frame, slot freed at frame end).
- **Capacity:** fixed `MAX_TOUCHES` (10); exceeding it throws.

## System order

`beginInputFrame` must be the first system in the step; `endInputFrame` the last. Ordering is by registration (`addSystem`) — not yet enforced by the kernel.
