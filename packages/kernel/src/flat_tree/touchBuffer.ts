import {TouchEventBuffer} from "./types";
import {MAX_TOUCHES} from "./constants";

export function createTouchBuffer(): TouchEventBuffer {
    const touchX: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);
    const touchY: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);
    const beginX: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);
    const beginY: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);
    const beganThisFrame: Uint8Array = new Uint8Array(MAX_TOUCHES).fill(0);
    const movedThisFrame: Uint8Array = new Uint8Array(MAX_TOUCHES).fill(0);
    const endedThisFrame: Uint8Array = new Uint8Array(MAX_TOUCHES).fill(0);
    const canceledThisFrame: Uint8Array = new Uint8Array(MAX_TOUCHES).fill(0);
    const touchId: Int32Array = new Int32Array(MAX_TOUCHES).fill(-1);

    return {
        touchX,
        touchY,
        beginX,
        beginY,
        beganThisFrame,
        movedThisFrame,
        endedThisFrame,
        canceledThisFrame,
        touchId,
    }
}
