import { SpriteAtlasLookup } from '@engine/kernel';

/**
 * Sprite source rectangle definitions for the spritesheet.
 *
 * The spritesheet is a 1024×1024 PNG with a 4×4 grid.
 * Each cell is ~256×256 pixels. We define 16 sprite types (one per cell).
 * For v0, we only use the first 4 for simplicity.
 */

// Spritesheet grid layout
export const FRAME_SIZE = 256;
export const COLS = 4;
export const ROWS = 4;
export const SPRITE_COUNT_TYPES = COLS * ROWS; // 16 available types

/**
 * Returns the source rect {x, y, width, height} for a given sprite type index.
 * Called from worklet context — no Skia rect() helper needed, just raw numbers.
 */
export function getSpriteRect(typeIndex: number): { x: number; y: number; w: number; h: number } {
    'worklet';
    const col = typeIndex % COLS;
    const row = Math.floor(typeIndex / COLS);
    return {
        x: col * FRAME_SIZE,
        y: row * FRAME_SIZE,
        w: FRAME_SIZE,
        h: FRAME_SIZE,
    };
}

export function createSpriteAtlasLookup(): SpriteAtlasLookup {
    'worklet';
    const res = {
        widths: new Float32Array(SPRITE_COUNT_TYPES),
        heights: new Float32Array(SPRITE_COUNT_TYPES),
        pivotXs: new Float32Array(SPRITE_COUNT_TYPES).fill(0.5),
        pivotYs: new Float32Array(SPRITE_COUNT_TYPES).fill(0.5),
    }

    for (let i: number = 0; i < SPRITE_COUNT_TYPES; i++) {
        const { w, h } = getSpriteRect(i);
        res.widths[i] = w;
        res.heights[i] = h;
    }

    return res;
}
