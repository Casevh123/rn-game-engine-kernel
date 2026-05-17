import {NULL} from "./constants";
import {NodeHandle, ComponentPool, FlatWorld} from "./types";

/**
 * Creates a component pool that maps node IDs to dense component indices.
 *
 * @param world - The world this pool belongs to
 * @param poolCapacity - Maximum number of components in this pool
 * @param swapComponentData - User-provided callback to swap component data
 *   at two indices during remove (swap-and-pop). This is where the user's
 *   TypedArray data gets swapped.
 */
export function createComponentPool(
    world: FlatWorld,
    poolCapacity: number,
    swapComponentData: (indexA: number, indexB: number) => void,
): ComponentPool {
    'worklet';
    const nodeToComponent = new Int32Array(world.capacity);
    const componentToNode = new Int32Array(poolCapacity);
    const componentToVersion = new Int32Array(poolCapacity);

    nodeToComponent.fill(NULL);
    let count: number = 0;

    function add(ref: NodeHandle): number {
        world.assertValidRef(ref);

        if (nodeToComponent[ref.id] !== NULL) {
            throw new Error("Node already has this component");
        }

        if (count >= poolCapacity) {
            throw new Error("Component pool at capacity");
        }

        const compId: number = count;
        nodeToComponent[ref.id] = compId;
        componentToNode[compId] = ref.id;
        componentToVersion[compId] = ref.version;
        count++;
        return compId;
    }

    function remove(ref: NodeHandle): void {
        world.assertValidRef(ref);

        if (nodeToComponent[ref.id] === NULL) {
            throw new Error("Node does not have this component");
        }

        _removeByNodeId(ref.id);
    }

    function has(ref: NodeHandle): boolean {
        world.assertValidRef(ref);
        return nodeToComponent[ref.id] !== NULL;
    }

    function get(ref: NodeHandle): number {
        world.assertValidRef(ref);

        if (nodeToComponent[ref.id] === NULL) {
            throw new Error("Node does not have this component");
        }

        return nodeToComponent[ref.id];
    }

    function getByNodeId(nodeId: number): number {
        return nodeToComponent[nodeId];
    }

    function getNodeHandle(index: number): NodeHandle {
        const id: number = nodeIdAt(index);
        return { id, version: componentToVersion[index] };
    }

    function nodeIdAt(index: number): number {
        if (index < 0 || index >= count) {
            throw new Error("Index out of bounds");
        }
        return componentToNode[index];
    }

    function belongsTo(w: FlatWorld): boolean {
        return world === w;
    }

    function _removeByNodeId(nodeId: number): void {
        const compId: number = nodeToComponent[nodeId];

        if (compId === NULL) {
            return;
        }

        const lastIdx: number = count - 1;
        if (compId !== lastIdx) {
            const moveNodeId: number = componentToNode[lastIdx];
            swapComponentData(compId, lastIdx);
            componentToNode[compId] = componentToNode[lastIdx];
            componentToVersion[compId] = componentToVersion[lastIdx];
            nodeToComponent[moveNodeId] = compId;
        }

        nodeToComponent[nodeId] = NULL;
        count--;
    }

    return {
        get count() { return count; },
        get capacity() { return poolCapacity; },
        add,
        remove,
        has,
        get,
        getByNodeId,
        getNodeHandle,
        nodeIdAt,
        belongsTo,
        _removeByNodeId,
    };
}
