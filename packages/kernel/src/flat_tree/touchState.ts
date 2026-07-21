import {TouchState} from "./types";
import {MAX_TOUCHES} from "./constants";

export function createTouchState(): TouchState {
    'worklet';
    const touchX: Float32Array = new Float32Array(MAX_TOUCHES);
    const touchY: Float32Array = new Float32Array(MAX_TOUCHES);
    const startX: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);
    const startY: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);
    const startTime: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);
    const prevX: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);
    const prevY: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);
    const beganThisFrame: Uint8Array = new Uint8Array(MAX_TOUCHES).fill(0);
    const movedThisFrame: Uint8Array = new Uint8Array(MAX_TOUCHES).fill(0);
    const endedThisFrame: Uint8Array = new Uint8Array(MAX_TOUCHES).fill(0);
    const canceledThisFrame: Uint8Array = new Uint8Array(MAX_TOUCHES).fill(0);
    const touchVisible: Uint8Array = new Uint8Array(MAX_TOUCHES).fill(0);
    let visibleTouchCount: number = 0;

    return {
        touchX,
        touchY,
        startX,
        startY,
        startTime,
        prevX,
        prevY,
        beganThisFrame,
        movedThisFrame,
        endedThisFrame,
        canceledThisFrame,
        touchVisible,
        visibleTouchCount,
    }
}
