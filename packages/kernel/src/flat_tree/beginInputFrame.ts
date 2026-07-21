import {FlatWorld, TouchEventBuffer, System, TouchState} from "./types";
import {MAX_TOUCHES} from "./constants";

export function createBeginInputFrame(buffer: TouchEventBuffer, state: TouchState): System {
    'worklet';
    return (world: FlatWorld, dt: number): void => {
        for (let i: number = 0; i < MAX_TOUCHES; i++) {
            if (buffer.touchId[i] === -1){
                continue;
            }

            state.touchVisible[i] = 1;

            if (buffer.beganThisFrame[i] !== 0) {
                state.startX[i] = buffer.beginX[i];
                state.startY[i] = buffer.beginY[i];
                state.startTime[i] = world.getTime();

                state.touchX[i] = buffer.touchX[i];
                state.touchY[i] = buffer.touchY[i];

                state.prevX[i] = buffer.touchX[i];
                state.prevY[i] = buffer.touchY[i];

                state.visibleTouchCount++;
            } else {
                state.prevX[i] = state.touchX[i];
                state.prevY[i] = state.touchY[i];

                state.touchX[i] = buffer.touchX[i];
                state.touchY[i] = buffer.touchY[i];
            }

            state.beganThisFrame[i] = buffer.beganThisFrame[i];
            state.movedThisFrame[i] = buffer.movedThisFrame[i];
            state.endedThisFrame[i] = buffer.endedThisFrame[i];
            state.canceledThisFrame[i] = buffer.canceledThisFrame[i];
        }
    }
}
