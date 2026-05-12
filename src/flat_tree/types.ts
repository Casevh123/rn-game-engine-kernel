import {FlatWorld} from "./FlatWorld";

export type System = (world: FlatWorld, dt: number) => void;

/**
 * A lightweight, identity-only handle to a node in the world.
 * Carries no world reference and no methods — just the slot ID
 * and the generation counter needed for stale-ref detection.
 */
export type NodeHandle = { readonly id: number; readonly version: number };

/**
 * Value-equality check for two NodeHandles.
 */
export function refEquals(a: NodeHandle, b: NodeHandle): boolean {
    return a.id === b.id && a.version === b.version;
}
