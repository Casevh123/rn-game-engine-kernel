import {FlatWorld, TouchInputAccumulator, System, TouchState} from "./types";
import {MAX_TOUCHES} from "./constants";

function clearTouchEventSlot(accumulator: TouchInputAccumulator, idx: number): void {
    'worklet';
    accumulator.touchX[idx] = 0;
    accumulator.touchY[idx] = 0;
    accumulator.beginX[idx] = 0;
    accumulator.beginY[idx] = 0;
    accumulator.beganSinceConsume[idx] = 0;
    accumulator.movedSinceConsume[idx] = 0;
    accumulator.endedSinceConsume[idx] = 0;
    accumulator.canceledSinceConsume[idx] = 0;
    accumulator.touchId[idx] = -1;
}

function clearTouchStateSlot(state: TouchState, idx: number): void {
    'worklet';
    state.touchX[idx] = 0;
    state.touchY[idx] = 0;
    state.startX[idx] = 0;
    state.startY[idx] = 0;
    state.startTime[idx] = 0;
    state.prevX[idx] = 0;
    state.prevY[idx] = 0;
    state.beganThisTick[idx] = 0;
    state.movedThisTick[idx] = 0;
    state.endedThisTick[idx] = 0;
    state.canceledThisTick[idx] = 0;
    state.touchVisible[idx] = 0;
}

export function createEndInputFrame(accumulator: TouchInputAccumulator, state: TouchState): System {
    'worklet';
    return (world: FlatWorld, dt: number): void => {
        for (let i: number = 0; i < MAX_TOUCHES; i++) {
            if (accumulator.touchId[i] === -1){
                continue;
            }

            const finished =
                accumulator.endedSinceConsume[i] ||
                accumulator.canceledSinceConsume[i];

            if (finished) {
                clearTouchEventSlot(accumulator, i);
                clearTouchStateSlot(state, i);
                state.visibleTouchCount--;
                continue;
            }

            accumulator.beganSinceConsume[i] = 0;
            accumulator.movedSinceConsume[i] = 0;
            accumulator.endedSinceConsume[i] = 0;
            accumulator.canceledSinceConsume[i] = 0;

            state.beganThisTick[i] = 0;
            state.movedThisTick[i] = 0;
            state.endedThisTick[i] = 0;
            state.canceledThisTick[i] = 0;
        }
    }
}

