import {FlatWorld} from "./FlatWorld";
import {NULL} from "./constants";
import {FlatNodeRef} from "./FlatNodeRef";

export abstract class ComponentPool {
    private readonly nodeToComponent: Int32Array;
    private readonly componentToNode: Int32Array;
    private readonly componentToVersion: Int32Array;
    private readonly _world: FlatWorld;
    private readonly _capacity: number;
    private _count: number;

    constructor(world: FlatWorld, capacity: number) {
        this._world = world;
        this._capacity = capacity;

        this.nodeToComponent = new Int32Array(this._world.capacity);
        this.componentToNode = new Int32Array(capacity);
        this.componentToVersion = new Int32Array(capacity);

        this.nodeToComponent.fill(NULL);
        this._count = 0;
    }

    get count(): number {
        return this._count;
    }

    get capacity(): number {
        return this._capacity;
    }

    protected abstract swapComponentData(indexA: number, indexB: number): void;

    add(ref: FlatNodeRef): number {
        this._world.assertInWorld(ref);

        if (this.nodeToComponent[ref.id] !== NULL) {
            throw new Error("Node already has this component");
        }

        if (this._count >= this._capacity) {
            throw new Error("Component pool at capacity");
        }

        const compId: number = this._count;
        this.nodeToComponent[ref.id] = compId;
        this.componentToNode[compId] = ref.id;
        this.componentToVersion[compId] = ref.version;
        this._count++;
        return compId;
    }



    remove(ref: FlatNodeRef): void {
        this._world.assertInWorld(ref);

        if (this.nodeToComponent[ref.id] === NULL) {
            throw new Error("Node does not have this component");
        }

        this._removeByNodeId(ref.id);
    }

    has(ref: FlatNodeRef): boolean {
        this._world.assertInWorld(ref);

        return this.nodeToComponent[ref.id] !== NULL;
    }

    get(ref: FlatNodeRef): number {
        this._world.assertInWorld(ref);

        if (this.nodeToComponent[ref.id] === NULL) {
            throw new Error("Node does not have this component");
        }

        return this.nodeToComponent[ref.id];
    }

    nodeIdAt(index: number): number {
        if (index < 0 || index >= this._count) {
            throw new Error("Index out of bounds");
        }

        return this.componentToNode[index];
    }

    belongsTo(world: FlatWorld): boolean {
        return this._world === world;
    }

    /**
     * @internal
     *
     * no ref validation, caller handles that
     */
    _removeByNodeId(nodeId: number): void {
        const compId: number = this.nodeToComponent[nodeId];

        if (compId === NULL) {
            // no-op: node doesn't have this component
            return;
        }

        const lastIdx: number = this._count - 1;
        if (compId !== lastIdx) {
            const moveNodeId: number = this.componentToNode[lastIdx];
            this.swapComponentData(compId, lastIdx);
            this.componentToNode[compId] = this.componentToNode[lastIdx];
            this.componentToVersion[compId] = this.componentToVersion[lastIdx];
            this.nodeToComponent[moveNodeId] = compId;
        }

        this.nodeToComponent[nodeId] = NULL;
        this._count--;
    }
}
