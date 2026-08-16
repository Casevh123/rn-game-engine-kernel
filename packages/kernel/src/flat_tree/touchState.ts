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
    const beganThisTick: Uint8Array = new Uint8Array(MAX_TOUCHES).fill(0);
    const movedThisTick: Uint8Array = new Uint8Array(MAX_TOUCHES).fill(0);
    const endedThisTick: Uint8Array = new Uint8Array(MAX_TOUCHES).fill(0);
    const canceledThisTick: Uint8Array = new Uint8Array(MAX_TOUCHES).fill(0);
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
        beganThisTick,
        movedThisTick,
        endedThisTick,
        canceledThisTick,
        touchVisible,
        visibleTouchCount,
    }
}
