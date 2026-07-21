import { createFlatWorld } from "../FlatWorld";
import { createTouchBuffer } from "../touchBuffer";
import { createTouchState } from "../touchState";
import { createBeginInputFrame } from "../beginInputFrame";
import { createEndInputFrame } from "../endInputFrame";
import {FlatWorld, System, TouchEventBuffer, TouchState} from "../types";
import {findInBuffer, writeTouchCancel, writeTouchDown, writeTouchMove, writeTouchUp} from "../touchProducerInterface";
import {MAX_TOUCHES} from "../constants";


describe("producer interface tests", () => {

    /*
     * Purpose:
     *   Proves slot allocation is deterministic and compact.
     */
    it("writeTouchDown uses the first available slot", () => {
        //Arrange
        const buffer: TouchEventBuffer = createTouchBuffer();

        // Act
        writeTouchDown(buffer, 1, 0, 0);
        writeTouchDown(buffer, 2, 0, 0);

        // Assert
        expect(buffer.touchId[0]).toEqual(1);
        expect(buffer.touchId[1]).toEqual(2);
    });

    /*
     * Purpose:
     *   Producer records raw facts only; kernel does not need to run yet.
     */
    it("writeTouchDown records begin facts without requiring a frame step", () => {
        // Arrange
        const buffer: TouchEventBuffer = createTouchBuffer();

        // Act
        writeTouchDown(buffer, 1, 10, 20);

        // Assert
        expect(buffer.touchId[0]).toBe(1);
        expect(buffer.touchX[0]).toBe(10);
        expect(buffer.touchY[0]).toBe(20);
        expect(buffer.beginX[0]).toBe(10);
        expect(buffer.beginY[0]).toBe(20);
        expect(buffer.beganThisFrame[0]).toBe(1);
        expect(buffer.movedThisFrame[0]).toBe(0);
        expect(buffer.endedThisFrame[0]).toBe(0);
        expect(buffer.canceledThisFrame[0]).toBe(0);
    });

    /*
     * Purpose:
     *   Proves overflow does not silently overwrite active touches.
     */
    it("writeTouchDown throws or fails when MAX_TOUCHES is exceeded", () => {
        // Arrange
        const buffer: TouchEventBuffer = createTouchBuffer();

        for (let i: number = 0; i < MAX_TOUCHES; i++) {
            writeTouchDown(buffer, i, 0, 0);
        }

        // Act & Assert
        expect(() => {writeTouchDown(buffer, MAX_TOUCHES, 10, 20)}).toThrow(`Exceeded MAX_TOUCHES: ${MAX_TOUCHES}`);
    });

    /*
     * Purpose:
     *   Producer can map native touch ids back to stable engine slots.
     */
    it("findTouchSlot returns the correct slot for an existing touch id", () => {
        // Arrange
        const buffer: TouchEventBuffer = createTouchBuffer();
        buffer.touchId[3] = 12; // Assume 3 < MAX_TOUCHES

        // Act
        const index: number = findInBuffer(buffer, 12);

        // Assert
        expect(index).toBe(3);
    });

    /*
     * Purpose:
     *   Missing native ids are handled explicitly.
     */
    it("findTouchSlot returns -1 for a missing touch id", () => {
        // Arrange
        const buffer: TouchEventBuffer = createTouchBuffer();
        for (let i: number = 0; i < MAX_TOUCHES; i++) {
            buffer.touchId[i] = i;
        }

        // Act
        const index: number = findInBuffer(buffer, MAX_TOUCHES);

        // Assert
        expect(index).toBe(-1);
    });

    /*
     * Purpose:
     *   Move must not erase the fact that the touch began this frame.
     */
    it("writeTouchMove updates latest position and preserves begin facts", () => {

        // Arrange
        const buffer: TouchEventBuffer = createTouchBuffer();
        writeTouchDown(buffer, 1, 10, 10);

        // Act
        writeTouchMove(buffer, 1, 30, 40);

        // Assert
        expect(buffer.touchX[0]).toBe(30);
        expect(buffer.touchY[0]).toBe(40);
        expect(buffer.beginX[0]).toBe(10);
        expect(buffer.beginY[0]).toBe(10);
        expect(buffer.beganThisFrame[0]).toBe(1);
        expect(buffer.movedThisFrame[0]).toBe(1);
        expect(buffer.endedThisFrame[0]).toBe(0);
        expect(buffer.canceledThisFrame[0]).toBe(0);
    });

    /*
     * Purpose:
     *   A move cannot create a touch implicitly.
     */
    it("writeTouchMove throws or fails when the touch id is unknown", () => {
        // Arrange
        const randomId: number = 10;
        const buffer: TouchEventBuffer = createTouchBuffer();

        // Act & Assert
        expect(() => {writeTouchMove(buffer, randomId, 0, 0)}).toThrow(`Touch with ID: ${randomId} does not exist`);
    });

    /*
     * Purpose:
     *   Producer records end facts but does not release the slot.
     */
    it("writeTouchUp updates latest position and preserves prior frame facts", () => {
        // Arrange
        const buffer: TouchEventBuffer = createTouchBuffer();
        writeTouchDown(buffer, 1, 10, 10);
        writeTouchMove(buffer, 1, 20, 20);

        // Act
        writeTouchUp(buffer, 1, 30, 30);

        // Assert
        expect(buffer.touchX[0]).toBe(30);
        expect(buffer.touchY[0]).toBe(30);
        expect(buffer.beginX[0]).toBe(10);
        expect(buffer.beginY[0]).toBe(10);
        expect(buffer.beganThisFrame[0]).toBe(1);
        expect(buffer.movedThisFrame[0]).toBe(1);
        expect(buffer.endedThisFrame[0]).toBe(1);
        expect(buffer.canceledThisFrame[0]).toBe(0);
    });

    /*
     * Purpose:
     *   Ending a nonexistent touch should not corrupt counts or slots.
     */
    it("writeTouchUp throws or fails when the touch id is unknown", () => {
        // Arrange
        const randomId: number = 10;
        const buffer: TouchEventBuffer = createTouchBuffer();

        // Act & Assert
        expect(() => {writeTouchUp(buffer, randomId, 10, 10)}).toThrow(`Touch with ID: ${randomId} does not exist`)
    });

    /*
     * Purpose:
     *   Canceled touches remain visible until endInputFrame consumes them.
     */
    it("writeTouchCancel marks cancellation without clearing the slot", () => {
        // Arrange
        const buffer: TouchEventBuffer = createTouchBuffer();
        writeTouchDown(buffer, 1, 10, 10);

        // Act
        writeTouchCancel(buffer, 1);

        // Assert
        expect(buffer.canceledThisFrame[0]).toBe(1);
        expect(buffer.touchId[0]).not.toBe(-1);
        expect(buffer.beganThisFrame[0]).toBe(1);
        expect(buffer.movedThisFrame[0]).toBe(0);
        expect(buffer.endedThisFrame[0]).toBe(0);
    });

    /*
     * Purpose:
     *   Canceling a nonexistent touch should not mutate random slots.
     */
    it("writeTouchCancel throws or fails when the touch id is unknown", () => {
        // Arrange
        const randomId: number = 10;
        const buffer: TouchEventBuffer = createTouchBuffer();

        // Act & Assert
        expect(() => {writeTouchCancel(buffer, randomId)}).toThrow(`Touch with ID: ${randomId} does not exist`);
    });
});

describe("frame boundary tests", () => {
    /*
     * Purpose:
     *   New touch becomes a normalized engine-readable touch.
     */
    it("beginInputFrame initializes state for a newly began touch", () => {
        // Arrange
        const buffer: TouchEventBuffer = createTouchBuffer();
        const state: TouchState = createTouchState();
        const world: FlatWorld = createFlatWorld(1000);
        world.step(12.5); // set world time to 12.5
        const beginInputFrame: System = createBeginInputFrame(buffer, state);

        writeTouchDown(buffer, 1, 10, 10);

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
        expect(state.beganThisFrame[0]).toBe(1);
        expect(state.movedThisFrame[0]).toBe(0);
        expect(state.endedThisFrame [0]).toBe(0);
        expect(state.canceledThisFrame[0]).toBe(0);
    });

    /*
     * Purpose:
     *   Delta contract works for existing touches.
     */
    it("beginInputFrame rolls existing current position into prev before copying latest position", () => {
        // Arrange
        const buffer: TouchEventBuffer = createTouchBuffer();
        const state: TouchState = createTouchState();
        state.touchX[0] = 10;
        state.touchY[0] = 10;
        buffer.touchId[0] = 1;
        buffer.touchX[0] = 20;
        buffer.touchY[0] = 20

        const world: FlatWorld = createFlatWorld(1000);
        const beginInputFrame: System = createBeginInputFrame(buffer, state);

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
     *   Gameplay reads a frozen snapshot from TouchState, not the producer buffer.
     */
    it("beginInputFrame copies frame flags from buffer into state", () => {
        // Arrange
        const beganThisFrame: number = Math.random() >= 0.5 ? 0 : 1;
        const movedThisFrame: number = Math.random() >= 0.5 ? 0 : 1;
        const endedThisFrame: number = Math.random() >= 0.5 ? 0 : 1;
        const canceledThisFrame: number = (Math.random() >= 0.5 || endedThisFrame == 1) ? 0 : 1;

        const buffer: TouchEventBuffer = createTouchBuffer();
        const state: TouchState = createTouchState();
        buffer.touchId[0] = 1;
        buffer.beganThisFrame[0] = beganThisFrame;
        buffer.movedThisFrame[0] = movedThisFrame;
        buffer.endedThisFrame[0] = endedThisFrame;
        buffer.canceledThisFrame[0] = canceledThisFrame;

        const world: FlatWorld = createFlatWorld(1000);
        const beginInputFrame: System = createBeginInputFrame(buffer, state);

        // Act
        beginInputFrame(world, 0);

        // Assert
        expect(state.beganThisFrame[0]).toBe(beganThisFrame);
        expect(state.movedThisFrame[0]).toBe(movedThisFrame);
        expect(state.endedThisFrame[0]).toBe(endedThisFrame);
        expect(state.canceledThisFrame[0]).toBe(canceledThisFrame);
    });

    /*
     * Purpose:
     *   Empty producer slots do not create phantom touches.
     */
    it("beginInputFrame ignores empty buffer slots", () => {
        // Arrange
        const buffer: TouchEventBuffer = createTouchBuffer();
        const state: TouchState = createTouchState();
        buffer.touchX[0] = 10;
        buffer.touchY[0] = 10;
        buffer.beginX[0] = 20;
        buffer.beginY[0] = 20;
        buffer.beganThisFrame[0] = 1;
        buffer.movedThisFrame[0] = 1;
        buffer.endedThisFrame[0] = 1;
        buffer.touchId[0] = -1;

        const world: FlatWorld = createFlatWorld(1000);
        const beginInputFrame: System = createBeginInputFrame(buffer, state);

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
        expect(state.beganThisFrame[0]).toBe(0);
        expect(state.movedThisFrame[0]).toBe(0);
        expect(state.endedThisFrame [0]).toBe(0);
        expect(state.canceledThisFrame[0]).toBe(0);
    });

    /*
     * Purpose:
     *   Held touches survive frame cleanup.
     */
    it("endInputFrame clears only transient flags for unfinished touches", () => {
        // Arrange
        const buffer: TouchEventBuffer = createTouchBuffer();
        const state: TouchState = createTouchState();
        buffer.touchId[0] = 1;
        buffer.beganThisFrame[0] = 1;
        buffer.movedThisFrame[0] = 1;
        state.touchVisible[0] = 1;
        state.visibleTouchCount = 1;

        const world: FlatWorld = createFlatWorld(1000);
        const endInputFrame: System = createEndInputFrame(buffer, state);

        // Act
        endInputFrame(world, 0);

        // Assert
        expect(buffer.beganThisFrame[0]).toBe(0);
        expect(buffer.movedThisFrame[0]).toBe(0);
        expect(state.touchVisible[0]).toBe(1);
        expect(state.visibleTouchCount).toBe(1);
    });

    /*
     * Purpose:
     *   Normal release is consumed after one visible frame.
     */
    it("endInputFrame clears buffer and state for ended touches", () => {
        // Arrange
        const buffer: TouchEventBuffer = createTouchBuffer();
        const state: TouchState = createTouchState();
        buffer.touchId[0] = 1;
        buffer.endedThisFrame[0] = 1;
        state.touchVisible[0] = 1;
        state.visibleTouchCount = 1;
        state.touchX[0] = 10;
        state.touchY[0] = 10;
        state.prevX[0] = 20;
        state.prevY[0] = 20;
        state.startX[0] = 30;
        state.startY[0] = 30;
        state.beganThisFrame[0] = 1;
        state.movedThisFrame[0] = 1;

        const world: FlatWorld = createFlatWorld(1000);
        const endInputFrame: System = createEndInputFrame(buffer, state);

        // Act
        endInputFrame(world, 0);

        // Assert
        expect(buffer.touchId[0]).toBe(-1);
        expect(state.touchVisible[0]).toBe(0);
        expect(state.visibleTouchCount).toBe(0);
        expect(state.startX[0]).toBe(0);
        expect(state.startY[0]).toBe(0);
        expect(state.prevX[0]).toBe(0);
        expect(state.prevY[0]).toBe(0);
        expect(state.beganThisFrame[0]).toBe(0);
        expect(state.movedThisFrame[0]).toBe(0);
        expect(state.endedThisFrame[0]).toBe(0);
        expect(state.touchX[0]).toBe(0);
        expect(state.touchY[0]).toBe(0);
    });

    /*
     * Purpose:
     *   Canceled touches use the same cleanup path as ended touches.
     */
    it("endInputFrame clears buffer and state for canceled touches", () => {
        // Arrange
        const buffer: TouchEventBuffer = createTouchBuffer();
        const state: TouchState = createTouchState();
        buffer.touchId[0] = 1;
        buffer.canceledThisFrame[0] = 1;
        state.touchVisible[0] = 1;
        state.visibleTouchCount = 1;
        state.touchX[0] = 10;
        state.touchY[0] = 10;
        state.prevX[0] = 20;
        state.prevY[0] = 20;
        state.startX[0] = 30;
        state.startY[0] = 30;
        state.beganThisFrame[0] = 1;
        state.movedThisFrame[0] = 1;

        const world: FlatWorld = createFlatWorld(1000);
        const endInputFrame: System = createEndInputFrame(buffer, state);

        // Act
        endInputFrame(world, 0);

        // Assert
        expect(buffer.touchId[0]).toBe(-1);
        expect(state.touchVisible[0]).toBe(0);
        expect(state.visibleTouchCount).toBe(0);
        expect(state.startX[0]).toBe(0);
        expect(state.startY[0]).toBe(0);
        expect(state.prevX[0]).toBe(0);
        expect(state.prevY[0]).toBe(0);
        expect(state.beganThisFrame[0]).toBe(0);
        expect(state.movedThisFrame[0]).toBe(0);
        expect(state.canceledThisFrame[0]).toBe(0);
        expect(state.touchX[0]).toBe(0);
        expect(state.touchY[0]).toBe(0)
    });

    /*
     * Purpose:
     *   Cleanup is stable and does not double-decrement.
     */
    it("endInputFrame does not make visibleTouchCount negative when called repeatedly", () => {
        // Arrange
        const buffer: TouchEventBuffer = createTouchBuffer();
        const state: TouchState = createTouchState();
        buffer.touchId[0] = 1;
        buffer.endedThisFrame[0] = 1;
        state.touchVisible[0] = 1;
        state.visibleTouchCount = 1;

        const world: FlatWorld = createFlatWorld(1000);
        const endInputFrame: System = createEndInputFrame(buffer, state);

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
    let buffer: TouchEventBuffer;
    let state: TouchState;

    beforeEach(() => {
        world = createFlatWorld(1000);
        buffer = createTouchBuffer();
        state = createTouchState();
        beginInputFrame = createBeginInputFrame(buffer, state);
        endInputFrame = createEndInputFrame(buffer, state);
    })

    /*
     * Purpose:
     *   Proves fast taps are not lost by producer coalescing.
     */
    it("begin and end in the same frame are both visible to the kernel", () => {
        // Arrange
        const id: number = 4;
        writeTouchDown(buffer, id, 10, 10);
        writeTouchUp(buffer, id, 10, 10);

        // Act #1
        beginInputFrame(world, 0);

        // Assert #1
        const slot: number = findInBuffer(buffer, id)
        expect(state.beganThisFrame[slot]).toBe(1);
        expect(state.endedThisFrame[slot]).toBe(1);
        expect(state.touchVisible[slot]).toBe(1);
        expect(state.visibleTouchCount).toBe(1);
        expect(state.startX[0]).toBe(10);
        expect(state.startY[0]).toBe(10);
        expect(state.touchX[0]).toBe(10);
        expect(state.touchY[0]).toBe(10);

        // Act #2
        endInputFrame(world, 0);

        // Assert #2
        expect(buffer.touchId[slot]).toBe(-1);
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
        writeTouchDown(buffer, id, 10, 10);
        writeTouchMove(buffer, id, 30, 20);
        writeTouchUp(buffer, id, 50, 40);

        // Act
        beginInputFrame(world, 0);

        // Assert
        const slot: number = findInBuffer(buffer, id);
        expect(state.beganThisFrame[slot]).toBe(1);
        expect(state.movedThisFrame[slot]).toBe(1);
        expect(state.endedThisFrame[slot]).toBe(1);
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
        writeTouchDown(buffer, id, 10, 10);
        writeTouchMove(buffer, id, 30, 25);

        // Act
        beginInputFrame(world, 0);

        // Assert
        const slot: number = findInBuffer(buffer, id)
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
        writeTouchDown(buffer, id, 10, 10);
        beginInputFrame(world, 0);
        endInputFrame(world, 0);

        writeTouchUp(buffer, id, 10, 10);

        // Act #1
        beginInputFrame(world, 0);

        // Assert #1 (mid frame)
        const slot: number = findInBuffer(buffer, id);
        expect(state.touchVisible[slot]).toBe(1);
        expect(state.endedThisFrame[slot]).toBe(1);

        // Act #2
        endInputFrame(world, 0);

        // Assert #2
        expect(state.touchVisible[slot]).toBe(0);
        expect(buffer.touchId[slot]).toBe(-1);
    });

    /*
     * Purpose:
     *   Systems get one frame to abort/rollback canceled gestures.
     */
    it("canceled touches remain visible for exactly one frame", () => {
        // Arrange
        const id: number = 4;
        writeTouchDown(buffer, id, 10, 10);
        beginInputFrame(world, 0);
        endInputFrame(world, 0);

        writeTouchCancel(buffer, id);

        // Act #1
        beginInputFrame(world, 0);

        // Assert #1 (mid frame)
        const slot: number = findInBuffer(buffer, id);
        expect(state.touchVisible[slot]).toBe(1);
        expect(state.canceledThisFrame[slot]).toBe(1);

        // Act #2
        endInputFrame(world, 0);

        // Assert #2
        expect(state.touchVisible[slot]).toBe(0);
        expect(buffer.touchId[slot]).toBe(-1);
    });

    /*
     * Purpose:
     *   A held touch does not disappear just because no new events arrived.
     */
    it("held stationary touches survive cleanup across frames", () => {
        // Arrange
        const id: number = 4;
        writeTouchDown(buffer, id, 10, 10);
        beginInputFrame(world, 0);
        endInputFrame(world, 0);

        // Act
        beginInputFrame(world, 0);

        // Assert
        const slot: number = findInBuffer(buffer, id);
        expect(state.touchVisible[slot]).toBe(1);
        expect(state.beganThisFrame[slot]).toBe(0);
        expect(state.movedThisFrame[slot]).toBe(0);
        expect(state.endedThisFrame[slot]).toBe(0);
        expect(state.canceledThisFrame[slot]).toBe(0);
        expect(buffer.beganThisFrame[slot]).toBe(0);
        expect(buffer.movedThisFrame[slot]).toBe(0);
        expect(buffer.endedThisFrame[slot]).toBe(0);
        expect(buffer.canceledThisFrame[slot]).toBe(0);
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
        writeTouchDown(buffer, id, 10, 10);
        beginInputFrame(world, 0);
        endInputFrame(world, 0);

        writeTouchMove(buffer, id, 20, 15);

        // Act
        beginInputFrame(world, 0);

        // Assert
        const slot: number = findInBuffer(buffer, id);
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
        writeTouchDown(buffer, id1, 10, 10);
        writeTouchUp(buffer, id1, 10, 10);
        const slot: number = findInBuffer(buffer, id1);
        beginInputFrame(world, 0);
        endInputFrame(world, 0);

        // Act
        writeTouchDown(buffer, id2, 50, 50);

        // Assert
        expect(buffer.touchId[slot]).toBe(id2);
        expect(buffer.beganThisFrame[slot]).toBe(1);
        expect(buffer.touchX[slot]).toBe(50);
        expect(buffer.touchY[slot]).toBe(50);
    });

    /*
     * Purpose:
     *   One touch ending does not corrupt another live touch.
     */
    it("multiple touches update and cleanup independently", () => {
        // Arrange
        const id1: number = 4;
        const id2: number = 2;
        writeTouchDown(buffer, id1, 10, 10);
        writeTouchDown(buffer, id2, 100, 100);
        const slot1: number = findInBuffer(buffer, id1);
        const slot2: number = findInBuffer(buffer, id2);
        beginInputFrame(world, 0);
        endInputFrame(world, 0);

        writeTouchMove(buffer, id1, 20, 10);
        writeTouchUp(buffer, id2, 100, 100);

        // Act #1
        beginInputFrame(world, 0);

        // Assert #1 (mid frame)
        expect(buffer.movedThisFrame[slot1]).toBe(1);
        expect(buffer.endedThisFrame[slot1]).toBe(0);
        expect(buffer.touchX[slot1]).toBe(20);

        expect(buffer.movedThisFrame[slot2]).toBe(0);
        expect(buffer.endedThisFrame[slot2]).toBe(1);
        expect(state.visibleTouchCount).toBe(2);

        // Act #2
        endInputFrame(world, 0);

        // Assert #2
        expect(state.touchVisible[slot1]).toBe(1);
        expect(state.touchVisible[slot2]).toBe(0);
        expect(buffer.touchId[slot1]).toBe(id1);
        expect(buffer.touchId[slot2]).toBe(-1);
        expect(state.visibleTouchCount).toBe(1);
    });

    /*
     * Purpose:
     *   Documents ownership: producer records facts, consumer releases slots.
     */
    it("producer never releases a finished touch before the kernel consumes it", () => {

        // Arrange
        const id: number = 4;
        writeTouchDown(buffer, id, 10, 10);
        writeTouchUp(buffer, id, 10, 10);
        const slot: number = findInBuffer(buffer, id);

        expect(buffer.touchId[slot]).toBe(id);
        expect(buffer.beganThisFrame[slot]).toBe(1);
        expect(buffer.endedThisFrame[slot]).toBe(1);

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
        writeTouchDown(buffer, id, 10, 10);
        writeTouchUp(buffer, id, 10, 10);
        const slot: number = findInBuffer(buffer, id);

        // Act
        beginInputFrame(world, 0);

        // Assert
        expect(state.visibleTouchCount).toBe(1);
        expect(state.endedThisFrame[slot]).toBe(1)
        /* Meaning:
         *   The finger is no longer physically down,
         *   but the touch is still visible to gameplay for this frame.
         */
    });
});
