import { createFlatWorld } from "../FlatWorld";
import { createTouchAccumulator } from "../touchAccumulator";
import { createTouchState } from "../touchState";
import { createBeginInputFrame } from "../beginInputFrame";
import { createEndInputFrame } from "../endInputFrame";
import {FlatWorld, System, TouchInputAccumulator, TouchState} from "../types";
import {findInBuffer, writeTouchCancel, writeTouchDown, writeTouchMove, writeTouchUp} from "../touchProducerInterface";
import {MAX_TOUCHES} from "../constants";


describe("producer interface tests", () => {

    /*
     * Purpose:
     *   Proves slot allocation is deterministic and compact.
     */
    it("writeTouchDown uses the first available slot", () => {
        //Arrange
        const accumulator: TouchInputAccumulator = createTouchAccumulator();

        // Act
        writeTouchDown(accumulator, 1, 0, 0);
        writeTouchDown(accumulator, 2, 0, 0);

        // Assert
        expect(accumulator.touchId[0]).toEqual(1);
        expect(accumulator.touchId[1]).toEqual(2);
    });

    /*
     * Purpose:
     *   Producer records raw facts only; kernel does not need to run yet.
     */
    it("writeTouchDown records begin facts without requiring a frame step", () => {
        // Arrange
        const accumulator: TouchInputAccumulator = createTouchAccumulator();

        // Act
        writeTouchDown(accumulator, 1, 10, 20);

        // Assert
        expect(accumulator.touchId[0]).toBe(1);
        expect(accumulator.touchX[0]).toBe(10);
        expect(accumulator.touchY[0]).toBe(20);
        expect(accumulator.beginX[0]).toBe(10);
        expect(accumulator.beginY[0]).toBe(20);
        expect(accumulator.beganSinceConsume[0]).toBe(1);
        expect(accumulator.movedSinceConsume[0]).toBe(0);
        expect(accumulator.endedSinceConsume[0]).toBe(0);
        expect(accumulator.canceledSinceConsume[0]).toBe(0);
    });

    /*
     * Purpose:
     *   Proves overflow does not silently overwrite active touches.
     */
    it("writeTouchDown throws or fails when MAX_TOUCHES is exceeded", () => {
        // Arrange
        const accumulator: TouchInputAccumulator = createTouchAccumulator();

        for (let i: number = 0; i < MAX_TOUCHES; i++) {
            writeTouchDown(accumulator, i, 0, 0);
        }

        // Act & Assert
        expect(() => {writeTouchDown(accumulator, MAX_TOUCHES, 10, 20)}).toThrow(`Exceeded MAX_TOUCHES: ${MAX_TOUCHES}`);
    });

    /*
     * Purpose:
     *   Producer can map native touch ids back to stable engine slots.
     */
    it("findTouchSlot returns the correct slot for an existing touch id", () => {
        // Arrange
        const accumulator: TouchInputAccumulator = createTouchAccumulator();
        accumulator.touchId[3] = 12; // Assume 3 < MAX_TOUCHES

        // Act
        const index: number = findInBuffer(accumulator, 12);

        // Assert
        expect(index).toBe(3);
    });

    /*
     * Purpose:
     *   Missing native ids are handled explicitly.
     */
    it("findTouchSlot returns -1 for a missing touch id", () => {
        // Arrange
        const accumulator: TouchInputAccumulator = createTouchAccumulator();
        for (let i: number = 0; i < MAX_TOUCHES; i++) {
            accumulator.touchId[i] = i;
        }

        // Act
        const index: number = findInBuffer(accumulator, MAX_TOUCHES);

        // Assert
        expect(index).toBe(-1);
    });

    /*
     * Purpose:
     *   Move must not erase the fact that the touch began this frame.
     */
    it("writeTouchMove updates latest position and preserves begin facts", () => {

        // Arrange
        const accumulator: TouchInputAccumulator = createTouchAccumulator();
        writeTouchDown(accumulator, 1, 10, 10);

        // Act
        writeTouchMove(accumulator, 1, 30, 40);

        // Assert
        expect(accumulator.touchX[0]).toBe(30);
        expect(accumulator.touchY[0]).toBe(40);
        expect(accumulator.beginX[0]).toBe(10);
        expect(accumulator.beginY[0]).toBe(10);
        expect(accumulator.beganSinceConsume[0]).toBe(1);
        expect(accumulator.movedSinceConsume[0]).toBe(1);
        expect(accumulator.endedSinceConsume[0]).toBe(0);
        expect(accumulator.canceledSinceConsume[0]).toBe(0);
    });

    /*
     * Purpose:
     *   A move cannot create a touch implicitly.
     */
    it("writeTouchMove throws or fails when the touch id is unknown", () => {
        // Arrange
        const randomId: number = 10;
        const accumulator: TouchInputAccumulator = createTouchAccumulator();

        // Act & Assert
        expect(() => {writeTouchMove(accumulator, randomId, 0, 0)}).toThrow(`Touch with ID: ${randomId} does not exist`);
    });

    /*
     * Purpose:
     *   Producer records end facts but does not release the slot.
     */
    it("writeTouchUp updates latest position and preserves prior frame facts", () => {
        // Arrange
        const accumulator: TouchInputAccumulator = createTouchAccumulator();
        writeTouchDown(accumulator, 1, 10, 10);
        writeTouchMove(accumulator, 1, 20, 20);

        // Act
        writeTouchUp(accumulator, 1, 30, 30);

        // Assert
        expect(accumulator.touchX[0]).toBe(30);
        expect(accumulator.touchY[0]).toBe(30);
        expect(accumulator.beginX[0]).toBe(10);
        expect(accumulator.beginY[0]).toBe(10);
        expect(accumulator.beganSinceConsume[0]).toBe(1);
        expect(accumulator.movedSinceConsume[0]).toBe(1);
        expect(accumulator.endedSinceConsume[0]).toBe(1);
        expect(accumulator.canceledSinceConsume[0]).toBe(0);
    });

    /*
     * Purpose:
     *   Ending a nonexistent touch should not corrupt counts or slots.
     */
    it("writeTouchUp throws or fails when the touch id is unknown", () => {
        // Arrange
        const randomId: number = 10;
        const accumulator: TouchInputAccumulator = createTouchAccumulator();

        // Act & Assert
        expect(() => {writeTouchUp(accumulator, randomId, 10, 10)}).toThrow(`Touch with ID: ${randomId} does not exist`)
    });

    /*
     * Purpose:
     *   Canceled touches remain visible until endInputFrame consumes them.
     */
    it("writeTouchCancel marks cancellation without clearing the slot", () => {
        // Arrange
        const accumulator: TouchInputAccumulator = createTouchAccumulator();
        writeTouchDown(accumulator, 1, 10, 10);

        // Act
        writeTouchCancel(accumulator, 1);

        // Assert
        expect(accumulator.canceledSinceConsume[0]).toBe(1);
        expect(accumulator.touchId[0]).not.toBe(-1);
        expect(accumulator.beganSinceConsume[0]).toBe(1);
        expect(accumulator.movedSinceConsume[0]).toBe(0);
        expect(accumulator.endedSinceConsume[0]).toBe(0);
    });

    /*
     * Purpose:
     *   Canceling a nonexistent touch should not mutate random slots.
     */
    it("writeTouchCancel throws or fails when the touch id is unknown", () => {
        // Arrange
        const randomId: number = 10;
        const accumulator: TouchInputAccumulator = createTouchAccumulator();

        // Act & Assert
        expect(() => {writeTouchCancel(accumulator, randomId)}).toThrow(`Touch with ID: ${randomId} does not exist`);
    });
});

describe("frame boundary tests", () => {
    /*
     * Purpose:
     *   New touch becomes a normalized engine-readable touch.
     */
    it("beginInputFrame initializes state for a newly began touch", () => {
        // Arrange
        const accumulator: TouchInputAccumulator = createTouchAccumulator();
        const state: TouchState = createTouchState();
        const world: FlatWorld = createFlatWorld(1000);
        world.step(12.5); // set world time to 12.5
        const beginInputFrame: System = createBeginInputFrame(accumulator, state);

        writeTouchDown(accumulator, 1, 10, 10);

        // Act
        beginInputFrame(world, 0);

        // Assert
        expect(state.touchVisible[0]).toBe(1);
        expect(state.startX[0]).toBe(10);
        expect(state.startY[0]).toBe(10);
        expect(state.startTime[0]).toBe(12.5);
        expect(state.touchX[0]).toBe(10);
        expect(state.touchY[0]).toBe(10);
        expect(state.prevX[0]).toBe(10);
        expect(state.prevY[0]).toBe(10);
        expect(state.visibleTouchCount).toBe(1);
        expect(state.beganThisTick[0]).toBe(1);
        expect(state.movedThisTick[0]).toBe(0);
        expect(state.endedThisTick [0]).toBe(0);
        expect(state.canceledThisTick[0]).toBe(0);
    });

    /*
     * Purpose:
     *   Delta contract works for existing touches.
     */
    it("beginInputFrame rolls existing current position into prev before copying latest position", () => {
        // Arrange
        const accumulator: TouchInputAccumulator = createTouchAccumulator();
        const state: TouchState = createTouchState();
        state.touchX[0] = 10;
        state.touchY[0] = 10;
        accumulator.touchId[0] = 1;
        accumulator.touchX[0] = 20;
        accumulator.touchY[0] = 20

        const world: FlatWorld = createFlatWorld(1000);
        const beginInputFrame: System = createBeginInputFrame(accumulator, state);

        // Act
        beginInputFrame(world, 0);

        // Assert
        expect(state.touchX[0]).toBe(20);
        expect(state.touchY[0]).toBe(20);
        expect(state.prevX[0]).toBe(10);
        expect(state.prevY[0]).toBe(10);
    });

    /*
     * Purpose:
     *   Gameplay reads a frozen snapshot from TouchState, not the producer accumulator.
     */
    it("beginInputFrame copies frame flags from accumulator into state", () => {
        // Arrange
        const beganThisFrame: number = Math.random() >= 0.5 ? 0 : 1;
        const movedThisFrame: number = Math.random() >= 0.5 ? 0 : 1;
        const endedThisFrame: number = Math.random() >= 0.5 ? 0 : 1;
        const canceledThisFrame: number = (Math.random() >= 0.5 || endedThisFrame == 1) ? 0 : 1;

        const accumulator: TouchInputAccumulator = createTouchAccumulator();
        const state: TouchState = createTouchState();
        accumulator.touchId[0] = 1;
        accumulator.beganSinceConsume[0] = beganThisFrame;
        accumulator.movedSinceConsume[0] = movedThisFrame;
        accumulator.endedSinceConsume[0] = endedThisFrame;
        accumulator.canceledSinceConsume[0] = canceledThisFrame;

        const world: FlatWorld = createFlatWorld(1000);
        const beginInputFrame: System = createBeginInputFrame(accumulator, state);

        // Act
        beginInputFrame(world, 0);

        // Assert
        expect(state.beganThisTick[0]).toBe(beganThisFrame);
        expect(state.movedThisTick[0]).toBe(movedThisFrame);
        expect(state.endedThisTick[0]).toBe(endedThisFrame);
        expect(state.canceledThisTick[0]).toBe(canceledThisFrame);
    });

    /*
     * Purpose:
     *   Empty producer slots do not create phantom touches.
     */
    it("beginInputFrame ignores empty accumulator slots", () => {
        // Arrange
        const accumulator: TouchInputAccumulator = createTouchAccumulator();
        const state: TouchState = createTouchState();
        accumulator.touchX[0] = 10;
        accumulator.touchY[0] = 10;
        accumulator.beginX[0] = 20;
        accumulator.beginY[0] = 20;
        accumulator.beganSinceConsume[0] = 1;
        accumulator.movedSinceConsume[0] = 1;
        accumulator.endedSinceConsume[0] = 1;
        accumulator.touchId[0] = -1;

        const world: FlatWorld = createFlatWorld(1000);
        const beginInputFrame: System = createBeginInputFrame(accumulator, state);

        // Act
        beginInputFrame(world, 0);

        // Assert
        expect(state.visibleTouchCount).toBe(0);
        expect(state.touchVisible[0]).toBe(0);
        expect(state.startX[0]).toBe(0);
        expect(state.startY[0]).toBe(0);
        expect(state.touchX[0]).toBe(0);
        expect(state.touchY[0]).toBe(0);
        expect(state.prevX[0]).toBe(0);
        expect(state.prevY[0]).toBe(0);
        expect(state.beganThisTick[0]).toBe(0);
        expect(state.movedThisTick[0]).toBe(0);
        expect(state.endedThisTick [0]).toBe(0);
        expect(state.canceledThisTick[0]).toBe(0);
    });

    /*
     * Purpose:
     *   Held touches survive frame cleanup.
     */
    it("endInputFrame clears only transient flags for unfinished touches", () => {
        // Arrange
        const accumulator: TouchInputAccumulator = createTouchAccumulator();
        const state: TouchState = createTouchState();
        accumulator.touchId[0] = 1;
        accumulator.beganSinceConsume[0] = 1;
        accumulator.movedSinceConsume[0] = 1;
        state.touchVisible[0] = 1;
        state.visibleTouchCount = 1;

        const world: FlatWorld = createFlatWorld(1000);
        const endInputFrame: System = createEndInputFrame(accumulator, state);

        // Act
        endInputFrame(world, 0);

        // Assert
        expect(accumulator.beganSinceConsume[0]).toBe(0);
        expect(accumulator.movedSinceConsume[0]).toBe(0);
        expect(state.touchVisible[0]).toBe(1);
        expect(state.visibleTouchCount).toBe(1);
    });

    /*
     * Purpose:
     *   Normal release is consumed after one visible frame.
     */
    it("endInputFrame clears accumulator and state for ended touches", () => {
        // Arrange
        const accumulator: TouchInputAccumulator = createTouchAccumulator();
        const state: TouchState = createTouchState();
        accumulator.touchId[0] = 1;
        accumulator.endedSinceConsume[0] = 1;
        state.touchVisible[0] = 1;
        state.visibleTouchCount = 1;
        state.touchX[0] = 10;
        state.touchY[0] = 10;
        state.prevX[0] = 20;
        state.prevY[0] = 20;
        state.startX[0] = 30;
        state.startY[0] = 30;
        state.beganThisTick[0] = 1;
        state.movedThisTick[0] = 1;

        const world: FlatWorld = createFlatWorld(1000);
        const endInputFrame: System = createEndInputFrame(accumulator, state);

        // Act
        endInputFrame(world, 0);

        // Assert
        expect(accumulator.touchId[0]).toBe(-1);
        expect(state.touchVisible[0]).toBe(0);
        expect(state.visibleTouchCount).toBe(0);
        expect(state.startX[0]).toBe(0);
        expect(state.startY[0]).toBe(0);
        expect(state.prevX[0]).toBe(0);
        expect(state.prevY[0]).toBe(0);
        expect(state.beganThisTick[0]).toBe(0);
        expect(state.movedThisTick[0]).toBe(0);
        expect(state.endedThisTick[0]).toBe(0);
        expect(state.touchX[0]).toBe(0);
        expect(state.touchY[0]).toBe(0);
    });

    /*
     * Purpose:
     *   Canceled touches use the same cleanup path as ended touches.
     */
    it("endInputFrame clears accumulator and state for canceled touches", () => {
        // Arrange
        const accumulator: TouchInputAccumulator = createTouchAccumulator();
        const state: TouchState = createTouchState();
        accumulator.touchId[0] = 1;
        accumulator.canceledSinceConsume[0] = 1;
        state.touchVisible[0] = 1;
        state.visibleTouchCount = 1;
        state.touchX[0] = 10;
        state.touchY[0] = 10;
        state.prevX[0] = 20;
        state.prevY[0] = 20;
        state.startX[0] = 30;
        state.startY[0] = 30;
        state.beganThisTick[0] = 1;
        state.movedThisTick[0] = 1;

        const world: FlatWorld = createFlatWorld(1000);
        const endInputFrame: System = createEndInputFrame(accumulator, state);

        // Act
        endInputFrame(world, 0);

        // Assert
        expect(accumulator.touchId[0]).toBe(-1);
        expect(state.touchVisible[0]).toBe(0);
        expect(state.visibleTouchCount).toBe(0);
        expect(state.startX[0]).toBe(0);
        expect(state.startY[0]).toBe(0);
        expect(state.prevX[0]).toBe(0);
        expect(state.prevY[0]).toBe(0);
        expect(state.beganThisTick[0]).toBe(0);
        expect(state.movedThisTick[0]).toBe(0);
        expect(state.canceledThisTick[0]).toBe(0);
        expect(state.touchX[0]).toBe(0);
        expect(state.touchY[0]).toBe(0)
    });

    /*
     * Purpose:
     *   Cleanup is stable and does not double-decrement.
     */
    it("endInputFrame does not make visibleTouchCount negative when called repeatedly", () => {
        // Arrange
        const accumulator: TouchInputAccumulator = createTouchAccumulator();
        const state: TouchState = createTouchState();
        accumulator.touchId[0] = 1;
        accumulator.endedSinceConsume[0] = 1;
        state.touchVisible[0] = 1;
        state.visibleTouchCount = 1;

        const world: FlatWorld = createFlatWorld(1000);
        const endInputFrame: System = createEndInputFrame(accumulator, state);

        // Act
        endInputFrame(world, 0);
        endInputFrame(world, 0);

        // Assert
        expect(state.visibleTouchCount).toBe(0);
    });
});

describe("integration invariant tests", () => {
    let world: FlatWorld;
    let beginInputFrame: System;
    let endInputFrame: System;
    let accumulator: TouchInputAccumulator;
    let state: TouchState;

    beforeEach(() => {
        world = createFlatWorld(1000);
        accumulator = createTouchAccumulator();
        state = createTouchState();
        beginInputFrame = createBeginInputFrame(accumulator, state);
        endInputFrame = createEndInputFrame(accumulator, state);
    })

    /*
     * Purpose:
     *   Proves fast taps are not lost by producer coalescing.
     */
    it("begin and end in the same frame are both visible to the kernel", () => {
        // Arrange
        const id: number = 4;
        writeTouchDown(accumulator, id, 10, 10);
        writeTouchUp(accumulator, id, 10, 10);

        // Act #1
        beginInputFrame(world, 0);

        // Assert #1
        const slot: number = findInBuffer(accumulator, id)
        expect(state.beganThisTick[slot]).toBe(1);
        expect(state.endedThisTick[slot]).toBe(1);
        expect(state.touchVisible[slot]).toBe(1);
        expect(state.visibleTouchCount).toBe(1);
        expect(state.startX[0]).toBe(10);
        expect(state.startY[0]).toBe(10);
        expect(state.touchX[0]).toBe(10);
        expect(state.touchY[0]).toBe(10);

        // Act #2
        endInputFrame(world, 0);

        // Assert #2
        expect(accumulator.touchId[slot]).toBe(-1);
        expect(state.touchVisible[slot]).toBe(0);
        expect(state.visibleTouchCount).toBe(0);
    });

    /*
     * Purpose:
     *   Proves one-frame swipe/tap-drag data survives until systems read it.
     */
    it("begin, move, and end in the same frame preserve all facts", () => {
        // Arrange
        const id: number = 4;
        writeTouchDown(accumulator, id, 10, 10);
        writeTouchMove(accumulator, id, 30, 20);
        writeTouchUp(accumulator, id, 50, 40);

        // Act
        beginInputFrame(world, 0);

        // Assert
        const slot: number = findInBuffer(accumulator, id);
        expect(state.beganThisTick[slot]).toBe(1);
        expect(state.movedThisTick[slot]).toBe(1);
        expect(state.endedThisTick[slot]).toBe(1);
        expect(state.startX[slot]).toBe(10);
        expect(state.startY[slot]).toBe(10);
        expect(state.touchX[slot]).toBe(50);
        expect(state.touchY[slot]).toBe(40)
        expect(state.prevX[slot]).toBe(50);
        expect(state.prevY[slot]).toBe(40);
    });

    /*
     * Purpose:
     *   Documents the chosen first-frame delta contract.
     */
    it("new touches have zero frame delta but preserve drag delta", () => {
        // Arrange
        const id: number = 4;
        writeTouchDown(accumulator, id, 10, 10);
        writeTouchMove(accumulator, id, 30, 25);

        // Act
        beginInputFrame(world, 0);

        // Assert
        const slot: number = findInBuffer(accumulator, id)
        const frameDx: number = state.touchX[slot] - state.prevX[slot];
        const frameDy: number = state.touchY[slot] - state.prevY[slot];
        const dragDx: number = state.touchX[slot] - state.startX[slot];
        const dragDy: number = state.touchY[slot] - state.startY[slot];

        expect(frameDx).toBe(0);
        expect(frameDy).toBe(0);
        expect(dragDx).toBe(20);
        expect(dragDy).toBe(15);
    });

    /*
     * Purpose:
     *   Systems get one frame to react to release.
     */
    it("ended touches remain visible for exactly one frame", () => {
        // Arrange
        const id: number = 4;
        writeTouchDown(accumulator, id, 10, 10);
        beginInputFrame(world, 0);
        endInputFrame(world, 0);

        writeTouchUp(accumulator, id, 10, 10);

        // Act #1
        beginInputFrame(world, 0);

        // Assert #1 (mid frame)
        const slot: number = findInBuffer(accumulator, id);
        expect(state.touchVisible[slot]).toBe(1);
        expect(state.endedThisTick[slot]).toBe(1);

        // Act #2
        endInputFrame(world, 0);

        // Assert #2
        expect(state.touchVisible[slot]).toBe(0);
        expect(accumulator.touchId[slot]).toBe(-1);
    });

    /*
     * Purpose:
     *   Systems get one frame to abort/rollback canceled gestures.
     */
    it("canceled touches remain visible for exactly one frame", () => {
        // Arrange
        const id: number = 4;
        writeTouchDown(accumulator, id, 10, 10);
        beginInputFrame(world, 0);
        endInputFrame(world, 0);

        writeTouchCancel(accumulator, id);

        // Act #1
        beginInputFrame(world, 0);

        // Assert #1 (mid frame)
        const slot: number = findInBuffer(accumulator, id);
        expect(state.touchVisible[slot]).toBe(1);
        expect(state.canceledThisTick[slot]).toBe(1);

        // Act #2
        endInputFrame(world, 0);

        // Assert #2
        expect(state.touchVisible[slot]).toBe(0);
        expect(accumulator.touchId[slot]).toBe(-1);
    });

    /*
     * Purpose:
     *   A held touch does not disappear just because no new events arrived.
     */
    it("held stationary touches survive cleanup across frames", () => {
        // Arrange
        const id: number = 4;
        writeTouchDown(accumulator, id, 10, 10);
        beginInputFrame(world, 0);
        endInputFrame(world, 0);

        // Act
        beginInputFrame(world, 0);

        // Assert
        const slot: number = findInBuffer(accumulator, id);
        expect(state.touchVisible[slot]).toBe(1);
        expect(state.beganThisTick[slot]).toBe(0);
        expect(state.movedThisTick[slot]).toBe(0);
        expect(state.endedThisTick[slot]).toBe(0);
        expect(state.canceledThisTick[slot]).toBe(0);
        expect(accumulator.beganSinceConsume[slot]).toBe(0);
        expect(accumulator.movedSinceConsume[slot]).toBe(0);
        expect(accumulator.endedSinceConsume[slot]).toBe(0);
        expect(accumulator.canceledSinceConsume[slot]).toBe(0);
        expect(state.visibleTouchCount).toBe(1);
        expect(state.touchX[slot]).toBe(10);
        expect(state.touchY[slot]).toBe(10);
    });

    /*
     * Purpose:
     *   Existing touches roll old current position into prev correctly.
     */
    it("movement across frames produces correct frame delta", () => {
        // Arrange
        const id: number = 4;
        writeTouchDown(accumulator, id, 10, 10);
        beginInputFrame(world, 0);
        endInputFrame(world, 0);

        writeTouchMove(accumulator, id, 20, 15);

        // Act
        beginInputFrame(world, 0);

        // Assert
        const slot: number = findInBuffer(accumulator, id);
        expect(state.prevX[slot]).toBe(10);
        expect(state.prevY[slot]).toBe(10);
        expect(state.touchX[slot]).toBe(20);
        expect(state.touchY[slot]).toBe(15);
    });

    /*
     * Purpose:
     *   Finished touches do not leak slot state.
     */
    it("slot is reusable after an ended touch is consumed", () => {
        // Arrange
        const id1: number = 4;
        const id2: number = 2;
        writeTouchDown(accumulator, id1, 10, 10);
        writeTouchUp(accumulator, id1, 10, 10);
        const slot: number = findInBuffer(accumulator, id1);
        beginInputFrame(world, 0);
        endInputFrame(world, 0);

        // Act
        writeTouchDown(accumulator, id2, 50, 50);

        // Assert
        expect(accumulator.touchId[slot]).toBe(id2);
        expect(accumulator.beganSinceConsume[slot]).toBe(1);
        expect(accumulator.touchX[slot]).toBe(50);
        expect(accumulator.touchY[slot]).toBe(50);
    });

    /*
     * Purpose:
     *   One touch ending does not corrupt another live touch.
     */
    it("multiple touches update and cleanup independently", () => {
        // Arrange
        const id1: number = 4;
        const id2: number = 2;
        writeTouchDown(accumulator, id1, 10, 10);
        writeTouchDown(accumulator, id2, 100, 100);
        const slot1: number = findInBuffer(accumulator, id1);
        const slot2: number = findInBuffer(accumulator, id2);
        beginInputFrame(world, 0);
        endInputFrame(world, 0);

        writeTouchMove(accumulator, id1, 20, 10);
        writeTouchUp(accumulator, id2, 100, 100);

        // Act #1
        beginInputFrame(world, 0);

        // Assert #1 (mid frame)
        expect(accumulator.movedSinceConsume[slot1]).toBe(1);
        expect(accumulator.endedSinceConsume[slot1]).toBe(0);
        expect(accumulator.touchX[slot1]).toBe(20);

        expect(accumulator.movedSinceConsume[slot2]).toBe(0);
        expect(accumulator.endedSinceConsume[slot2]).toBe(1);
        expect(state.visibleTouchCount).toBe(2);

        // Act #2
        endInputFrame(world, 0);

        // Assert #2
        expect(state.touchVisible[slot1]).toBe(1);
        expect(state.touchVisible[slot2]).toBe(0);
        expect(accumulator.touchId[slot1]).toBe(id1);
        expect(accumulator.touchId[slot2]).toBe(-1);
        expect(state.visibleTouchCount).toBe(1);
    });

    /*
     * Purpose:
     *   Documents ownership: producer records facts, consumer releases slots.
     */
    it("producer never releases a finished touch before the kernel consumes it", () => {

        // Arrange
        const id: number = 4;
        writeTouchDown(accumulator, id, 10, 10);
        writeTouchUp(accumulator, id, 10, 10);
        const slot: number = findInBuffer(accumulator, id);

        expect(accumulator.touchId[slot]).toBe(id);
        expect(accumulator.beganSinceConsume[slot]).toBe(1);
        expect(accumulator.endedSinceConsume[slot]).toBe(1);

        // Act
        beginInputFrame(world, 0);

        // Assert
        expect(state.touchVisible[slot]).toBe(1);
    });

    /*
     * Purpose:
     *   Prevents future confusion between visible touches and down touches.
     */
    it("visibleTouchCount counts engine-visible touches, not only physically-down touches", () => {
        // Arrange
        const id: number = 4;
        writeTouchDown(accumulator, id, 10, 10);
        writeTouchUp(accumulator, id, 10, 10);
        const slot: number = findInBuffer(accumulator, id);

        // Act
        beginInputFrame(world, 0);

        // Assert
        expect(state.visibleTouchCount).toBe(1);
        expect(state.endedThisTick[slot]).toBe(1)
        /* Meaning:
         *   The finger is no longer physically down,
         *   but the touch is still visible to gameplay for this frame.
         */
    });
});
