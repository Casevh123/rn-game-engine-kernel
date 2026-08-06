import {TouchEventBuffer} from "./types";
import {MAX_TOUCHES} from "./constants";

export function writeTouchDown(buffer: TouchEventBuffer, id: number, x: number, y: number) {
    'worklet';
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

export function findInBuffer(buffer: TouchEventBuffer, id: number): number {
    'worklet';
    for (let i = 0; i < MAX_TOUCHES; i++) {
        if (buffer.touchId[i] === id) {
            return i;
        }
    }

    return -1;
}

export function writeTouchMove(buffer: TouchEventBuffer, id: number, x: number, y: number) {
    'worklet';
    const i: number = findInBuffer(buffer, id);

    if (i === -1) {
        throw new Error(`Touch with ID: ${id} does not exist`);
    }

    buffer.touchX[i] = x;
    buffer.touchY[i] = y;
    buffer.movedThisFrame[i] = 1;
}

export function writeTouchUp(buffer: TouchEventBuffer, id: number, x: number, y: number) {
    'worklet';
    const i: number = findInBuffer(buffer, id);

    if (i === -1) {
        throw new Error(`Touch with ID: ${id} does not exist`);
    }

    buffer.touchX[i] = x;
    buffer.touchY[i] = y;
    buffer.endedThisFrame[i] = 1;
}

export function writeTouchCancel(buffer: TouchEventBuffer, id: number) {
    'worklet';
    const i: number = findInBuffer(buffer, id);

    if (i === -1) {
        throw new Error(`Touch with ID: ${id} does not exist`);
    }

    buffer.canceledThisFrame[i] = 1;
}

