import {TouchEventBuffer} from "./types";
import {MAX_TOUCHES} from "./constants";

export function writeTouchesDown(buffer: TouchEventBuffer, id: number, x: number, y: number) {
    // find first open slot
    let i: number = 0;
    for (;i < MAX_TOUCHES; i++) {
        if (buffer.touchId[i] === -1) {
            break;
        }
    }

    if (i === MAX_TOUCHES) {
        throw new Error(`Exceeded MAX_TOUCHES: ${MAX_TOUCHES}`);
    }

    buffer.touchX[i] = x;
    buffer.touchY[i] = y;
    buffer.beginX[i] = x;
    buffer.beginY[i] = y;
    buffer.beganThisFrame[i] = 1;
    buffer.touchId[i] = id;
}

export function writeTouchesMove(buffer: TouchEventBuffer, id: number, x: number, y: number) {
    const i: number = findInBuffer(buffer, id);

    if (i === -1) {
        throw new Error(`Touch with ID: ${id} does not exist`);
    }

    buffer.touchX[i] = x;
    buffer.touchY[i] = y;
    buffer.movedThisFrame[i] = 1;
}

export function writeTouchesUp(buffer: TouchEventBuffer, id: number, x: number, y: number) {
    const i: number = findInBuffer(buffer, id);

    if (i === -1) {
        throw new Error(`Touch with ID: ${id} does not exist`);
    }

    buffer.touchX[i] = x;
    buffer.touchY[i] = y;
    buffer.endedThisFrame[i] = 1;
}

export function writeTouchesCancelled(buffer: TouchEventBuffer, id: number) {
    const i: number = findInBuffer(buffer, id);

    if (i === -1) {
        throw new Error(`Touch with ID: ${id} does not exist`);
    }

    buffer.canceledThisFrame[i] = 1;
}

export function findInBuffer(buffer: TouchEventBuffer, id: number): number {
    for (let i = 0; i < MAX_TOUCHES; i++) {
        if (buffer.touchId[i] === id) {
            return i;
        }
    }

    return -1;
}
