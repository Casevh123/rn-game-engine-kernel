import {ComponentPool, FlatWorld} from "./types";
import {createComponentPool} from "./ComponentPool";

export interface SpritePoolResult {
    pool: ComponentPool;
    spriteType: Int32Array;
}

export function createSpritePool(world: FlatWorld, capacity: number): SpritePoolResult {
    'worklet';
    const spriteType = new Int32Array(capacity);

    const pool = createComponentPool(world, capacity, (a: number, b: number): void => {
        const tmp: number = spriteType[a];
        spriteType[a] = spriteType[b];
        spriteType[b] = tmp;
    });

    return { pool, spriteType };
}
