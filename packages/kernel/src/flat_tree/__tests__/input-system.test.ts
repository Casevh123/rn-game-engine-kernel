import {FlatWorld, InputBuffer, System, TouchHistory} from "../types";
import {createFlatWorld} from "../FlatWorld";
import {createInputBuffer} from "../InputBuffer";
import {createTouchHistory} from "../TouchHistory";
import {createInputSystem} from "../InputSystem";
import {PHASE_BEGAN, PHASE_CANCELLED, PHASE_ENDED, PHASE_MOVED, PHASE_NONE} from "../constants";

describe('Input system', () => {
    let world: FlatWorld;
    let buffer: InputBuffer;
    let history: TouchHistory;

    beforeEach(() => {
        const _world = createFlatWorld(1024);
        const _buffer = createInputBuffer();
        const _history = createTouchHistory();
        const _inputSystem = createInputSystem(_buffer, _history);
        _world.addSystem(_inputSystem);

        world = _world;
        buffer = _buffer;
        history = _history;
    });

    it('BEGAN → MOVED after one step', () => {
        buffer.touchPhase[0] = PHASE_BEGAN;

        world.step(0);

        expect(buffer.touchPhase[0]).toBe(PHASE_MOVED);
    })

    it('History snapshotted on BEGAN', () => {
        buffer.touchPhase[0] = PHASE_BEGAN;
        buffer.touchX[0] = 1;
        buffer.touchY[0] = 100;
        history.duration[0] = 10;

        world.step(0);

        expect(history.startX[0]).toBe(1);
        expect(history.startY[0]).toBe(100);
        expect(history.duration[0]).toBe(0);
    })

    it('prevX/Y updated on MOVED', () => {
        buffer.touchPhase[0] = PHASE_MOVED;
        buffer.touchX[0] = 1;
        buffer.touchY[0] = 100;

        world.step(0);

        expect(history.prevX[0]).toBe(1);
        expect(history.prevY[0]).toBe(100);
    })

    it('duration accumulates on MOVED.', () => {
        buffer.touchPhase[0] = PHASE_MOVED;

        world.step(0.5);
        expect(history.duration[0]).toBe(0.5);
        world.step(0.5);
        expect(history.duration[0]).toBe(1);
    })

    it('ENDED → NONE, slot freed', () => {
        buffer.touchPhase[0] = PHASE_ENDED;

        world.step(0);

        expect(buffer.touchPhase[0]).toBe(PHASE_NONE);
        expect(buffer.activeTouchCount).toBe(-1);
    })

    it('CANCELLED → NONE, slot freed', () => {
        buffer.touchPhase[0] = PHASE_CANCELLED;

        world.step(0);

        expect(buffer.touchPhase[0]).toBe(PHASE_NONE);
        expect(buffer.activeTouchCount).toBe(-1);
    })

    it('PHASE_NONE slots untouched', () => {
        buffer.touchPhase[0] = PHASE_NONE;
        history.startX[0] = 1;
        history.startY[0] = 2;
        history.prevX[0] = 3;
        history.prevY[0] = 4;
        history.duration[0] = 5;
        history.startTime[0] = 6;

        world.step(0);

        expect(history.startX[0]).toBe(1);
        expect(history.startY[0]).toBe(2);
        expect(history.prevX[0]).toBe(3);
        expect(history.prevY[0]).toBe(4);
        expect(history.duration[0]).toBe(5);
        expect(history.startTime[0]).toBe(6);
    })

    it('multiple active slots', () => {
        buffer.touchPhase[0] = PHASE_BEGAN;
        buffer.touchPhase[1] = PHASE_BEGAN;

        buffer.touchX[0] = 1;
        buffer.touchX[1] = 2;

        world.step(0);
        expect(history.startX[0]).toBe(1);
        expect(history.startX[1]).toBe(2);
        buffer.touchPhase[1] = PHASE_ENDED;
        world.step(0.5);
        world.step(0.5);

        expect(history.duration[0]).toBe(1);
        expect(history.duration[1]).toBe(0.5);
        expect(buffer.touchPhase[1]).toBe(PHASE_NONE);
    })
})
