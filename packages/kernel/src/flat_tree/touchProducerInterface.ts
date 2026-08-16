import {TouchInputAccumulator} from "./types";
import {MAX_TOUCHES} from "./constants";

export function writeTouchDown(accumulator: TouchInputAccumulator, id: number, x: number, y: number) {
    'worklet';
    // find first open slot
    let i: number = 0;
    for (;i < MAX_TOUCHES; i++) {
        if (accumulator.touchId[i] === -1) {
            break;
        }
    }

    if (i === MAX_TOUCHES) {
        throw new Error(`Exceeded MAX_TOUCHES: ${MAX_TOUCHES}`);
    }

    accumulator.touchX[i] = x;
    accumulator.touchY[i] = y;
    accumulator.beginX[i] = x;
    accumulator.beginY[i] = y;
    accumulator.beganSinceConsume[i] = 1;
    accumulator.touchId[i] = id;
}

export function findInBuffer(accumulator: TouchInputAccumulator, id: number): number {
    'worklet';
    for (let i = 0; i < MAX_TOUCHES; i++) {
        if (accumulator.touchId[i] === id) {
            return i;
        }
    }

    return -1;
}

export function writeTouchMove(accumulator: TouchInputAccumulator, id: number, x: number, y: number) {
    'worklet';
    const i: number = findInBuffer(accumulator, id);

    if (i === -1) {
        throw new Error(`Touch with ID: ${id} does not exist`);
    }

    accumulator.touchX[i] = x;
    accumulator.touchY[i] = y;
    accumulator.movedSinceConsume[i] = 1;
}

export function writeTouchUp(accumulator: TouchInputAccumulator, id: number, x: number, y: number) {
    'worklet';
    const i: number = findInBuffer(accumulator, id);

    if (i === -1) {
        throw new Error(`Touch with ID: ${id} does not exist`);
    }

    accumulator.touchX[i] = x;
    accumulator.touchY[i] = y;
    accumulator.endedSinceConsume[i] = 1;
}

export function writeTouchCancel(accumulator: TouchInputAccumulator, id: number) {
    'worklet';
    const i: number = findInBuffer(accumulator, id);

    if (i === -1) {
        throw new Error(`Touch with ID: ${id} does not exist`);
    }

    accumulator.canceledSinceConsume[i] = 1;
}

