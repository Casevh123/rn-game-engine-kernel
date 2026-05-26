import {TouchHistory} from "./types";
import {MAX_TOUCHES} from "./constants";

export function createTouchHistory(): TouchHistory {
    const startX: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);
    const startY: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);
    const startTime: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);
    const prevX: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);
    const prevY: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);
    const duration: Float32Array = new Float32Array(MAX_TOUCHES).fill(0);

    return {
        startX,
        startY,
        startTime,
        prevX,
        prevY,
        duration,
    }
}
