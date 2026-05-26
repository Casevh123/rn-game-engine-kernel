import {FlatWorld, InputBuffer, System, TouchHistory} from "./types";
import {MAX_TOUCHES, PHASE_BEGAN, PHASE_CANCELLED, PHASE_ENDED, PHASE_MOVED, PHASE_NONE} from "./constants";

export function createInputSystem(buffer: InputBuffer, history: TouchHistory): System {
    return (world: FlatWorld, dt: number): void => {
        for (let i: number = 0; i < MAX_TOUCHES - 1; i++) {
            const phase: number = buffer.touchPhase[i];

            if (phase === PHASE_BEGAN) {
                history.startX[i] = buffer.touchX[i];
                history.startY[i] = buffer.touchY[i];
                history.startTime[i] = world.getTime();
                history.prevX[i] = buffer.touchX[i];
                history.prevY[i] = buffer.touchY[i];
                history.duration[i] = 0;

                buffer.touchPhase[i] = PHASE_MOVED;
            } else if (phase === PHASE_MOVED) {
                history.prevX[i] = buffer.touchX[i];
                history.prevY[i] = buffer.touchY[i];
                history.duration[i] += dt;

            } else if (phase === PHASE_ENDED || phase === PHASE_CANCELLED) {
                history.duration[i] += dt;

                buffer.touchPhase[i] = PHASE_NONE;
                buffer.touchId[i] = -1;
                buffer.activeTouchCount--;
            }
        }
    }
}
