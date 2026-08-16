import {FlatWorld, TouchInputAccumulator, System, TouchState} from "./types";
import {MAX_TOUCHES} from "./constants";

export function createBeginInputFrame(accumulator: TouchInputAccumulator, state: TouchState): System {
    'worklet';
    return (world: FlatWorld, dt: number): void => {
        for (let i: number = 0; i < MAX_TOUCHES; i++) {
            if (accumulator.touchId[i] === -1){
                continue;
            }

            state.touchVisible[i] = 1;

            if (accumulator.beganSinceConsume[i] !== 0) {
                state.startX[i] = accumulator.beginX[i];
                state.startY[i] = accumulator.beginY[i];
                state.startTime[i] = world.getTime();

                state.touchX[i] = accumulator.touchX[i];
                state.touchY[i] = accumulator.touchY[i];

                state.prevX[i] = accumulator.touchX[i];
                state.prevY[i] = accumulator.touchY[i];

                state.visibleTouchCount++;
            } else {
                state.prevX[i] = state.touchX[i];
                state.prevY[i] = state.touchY[i];

                state.touchX[i] = accumulator.touchX[i];
                state.touchY[i] = accumulator.touchY[i];
            }

            state.beganThisTick[i] = accumulator.beganSinceConsume[i];
            state.movedThisTick[i] = accumulator.movedSinceConsume[i];
            state.endedThisTick[i] = accumulator.endedSinceConsume[i];
            state.canceledThisTick[i] = accumulator.canceledSinceConsume[i];
        }
    }
}
