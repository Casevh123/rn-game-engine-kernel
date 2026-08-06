import {FlatWorld, TouchEventBuffer, System, TouchState} from "./types";
import {MAX_TOUCHES} from "./constants";

function clearTouchEventSlot(buffer: TouchEventBuffer, idx: number): void {
    'worklet';
    buffer.touchX[idx] = 0;
    buffer.touchY[idx] = 0;
    buffer.beginX[idx] = 0;
    buffer.beginY[idx] = 0;
    buffer.beganThisFrame[idx] = 0;
    buffer.movedThisFrame[idx] = 0;
    buffer.endedThisFrame[idx] = 0;
    buffer.canceledThisFrame[idx] = 0;
    buffer.touchId[idx] = -1;
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
    state.beganThisFrame[idx] = 0;
    state.movedThisFrame[idx] = 0;
    state.endedThisFrame[idx] = 0;
    state.canceledThisFrame[idx] = 0;
    state.touchVisible[idx] = 0;
}

export function createEndInputFrame(buffer: TouchEventBuffer, state: TouchState): System {
    'worklet';
    return (world: FlatWorld, dt: number): void => {
        for (let i: number = 0; i < MAX_TOUCHES; i++) {
            if (buffer.touchId[i] === -1){
                continue;
            }

            const finished =
                buffer.endedThisFrame[i] ||
                buffer.canceledThisFrame[i];

            if (finished) {
                clearTouchEventSlot(buffer, i);
                clearTouchStateSlot(state, i);
                state.visibleTouchCount--;
                continue;
            }

            buffer.beganThisFrame[i] = 0;
            buffer.movedThisFrame[i] = 0;
            buffer.endedThisFrame[i] = 0;
            buffer.canceledThisFrame[i] = 0;

            state.beganThisFrame[i] = 0;
            state.movedThisFrame[i] = 0;
            state.endedThisFrame[i] = 0;
            state.canceledThisFrame[i] = 0;
        }
    }
}

