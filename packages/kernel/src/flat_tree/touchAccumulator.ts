import {TouchInputAccumulator} from "./types";
import {MAX_TOUCHES} from "./constants";

export function createTouchAccumulator(): TouchInputAccumulator {
    'worklet';
    const touchX: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);
    const touchY: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);
    const beginX: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);
    const beginY: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);
    const beganSinceConsume: Uint8Array = new Uint8Array(MAX_TOUCHES).fill(0);
    const movedSinceConsume: Uint8Array = new Uint8Array(MAX_TOUCHES).fill(0);
    const endedSinceConsume: Uint8Array = new Uint8Array(MAX_TOUCHES).fill(0);
    const canceledSinceConsume: Uint8Array = new Uint8Array(MAX_TOUCHES).fill(0);
    const touchId: Int32Array = new Int32Array(MAX_TOUCHES).fill(-1);

    return {
        touchX,
        touchY,
        beginX,
        beginY,
        beganSinceConsume,
        movedSinceConsume,
        endedSinceConsume,
        canceledSinceConsume,
        touchId,
    }
}
