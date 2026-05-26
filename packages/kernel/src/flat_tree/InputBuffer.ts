import {InputBuffer} from "./types";
import {MAX_TOUCHES, PHASE_NONE} from "./constants";

export function createInputBuffer(): InputBuffer {
    const touchX: Float32Array = new Float32Array(MAX_TOUCHES);
    const touchY: Float32Array = new Float32Array(MAX_TOUCHES);
    const touchPhase: Int32Array = new Int32Array(MAX_TOUCHES);
    const touchId: Int32Array = new Int32Array(MAX_TOUCHES);

    let activeTouchCount: number = 0;

    touchPhase.fill(PHASE_NONE);
    touchId.fill(-1);

    return {
        touchX,
        touchY,
        touchPhase,
        touchId,
        activeTouchCount,
    }
}
