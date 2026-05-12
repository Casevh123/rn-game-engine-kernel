import {ComponentPool} from "../ComponentPool";
import {FlatWorld} from "../FlatWorld";
import {NodeHandle, refEquals} from "../types";
import {NULL} from "../constants";


describe('component pool', () => {
    class TestPool extends ComponentPool {
        values: Int32Array;

        constructor(world: FlatWorld, capacity: number) {
            super(world, capacity);
            this.values = new Int32Array(capacity).fill(0);
        }

        protected swapComponentData(a: number, b: number): void {
            const tmp = this.values[a];
            this.values[a] = this.values[b];
            this.values[b] = tmp;
        }
    }

    describe('Happy Paths', () => {
        it('add returns sequential component IDS', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: NodeHandle = world.root;
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 5);

            const id0: number = pool.add(root);
            const id1: number = pool.add(node1);
            const id2: number = pool.add(node2);

            expect(id0).toBe(0);
            expect(id1).toBe(1);
            expect(id2).toBe(2);
        })

        it('has returns true false before add and true after', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: NodeHandle = world.root;
            const pool: TestPool = new TestPool(world, 5);

            expect(pool.has(root)).toBe(false);
            pool.add(root);
            expect(pool.has(root)).toBe(true);
        })

        it('get returns the correct component id', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: NodeHandle = world.root;
            const pool: TestPool = new TestPool(world, 5);

            const id: number = pool.add(root);

            expect(pool.get(root)).toBe(id);
        })

        it('getByNodeId returns the correct component id', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: NodeHandle = world.root;
            const pool: TestPool = new TestPool(world, 5);

            const id: number = pool.add(root);

            expect(pool.getByNodeId(root.id)).toBe(id);
        })

        it(`getByNodeId returns ${NULL} for node that doesn't have the component`, () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: NodeHandle = world.root;
            const pool: TestPool = new TestPool(world, 5);

            expect(pool.getByNodeId(root.id)).toBe(NULL);
        })

        it('getByNodeId returns correct index after swap and pop', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: NodeHandle = world.root;
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 5);
            pool.add(root);
            pool.add(node1);
            const originalId: number = pool.add(node2);

            expect(pool.getByNodeId(node2.id)).toBe(originalId);
            pool.remove(node1);
            const newId: number = pool.getByNodeId(node2.id);

            expect(originalId).not.toEqual(newId);
            expect(pool.nodeIdAt(newId)).toEqual(node2.id);
        })

        it('increments count on add', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: NodeHandle = world.root;
            const pool: TestPool = new TestPool(world, 5);


            expect(pool.count).toBe(0);
            pool.add(root);

            expect(pool.count).toBe(1);
        })

        it('decrements count on remove', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: NodeHandle = world.root;
            const pool: TestPool = new TestPool(world, 5);

            pool.add(root);
            expect(pool.count).toBe(1);
            pool.remove(root);

            expect(pool.count).toBe(0);
        })

        it('nodeIdAt(i) returns correct node id', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: NodeHandle = world.root;
            const pool: TestPool = new TestPool(world, 5);

            const id0: number = pool.add(root);

            expect(pool.nodeIdAt(id0)).toBe(root.id);
        })

        it('getNodeHandle(i) returns correct handle', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: NodeHandle = world.root;
            const pool: TestPool = new TestPool(world, 5);

            const id0: number = pool.add(root);

            expect(refEquals(pool.getNodeHandle(id0), root)).toBe(true);
        })

        it('after remove has return false', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: NodeHandle = world.root;
            const pool: TestPool = new TestPool(world, 5);

            const id0: number = pool.add(root);
            expect(pool.has(root)).toBe(true);
            pool.remove(root);

            expect(pool.has(root)).toBe(false);
        })

        it('after remove data can be read added to the same node', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: NodeHandle = world.root;
            const pool: TestPool = new TestPool(world, 5);

            pool.add(root);
            pool.remove(root);

            expect(() => pool.add(root)).not.toThrow();
        })
    })

    describe('Swap and Pop', () => {
        it('if you remove first of 3, last component gets moved to index 0, data swaps', () => {
            const world: FlatWorld = new FlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 5);

            pool.add(node1);
            pool.add(node2);
            pool.add(node3);
            pool.values[0] = 1;
            pool.values[1] = 2;
            pool.values[2] = 3;
            expect(pool.get(node1)).toBe(0);
            expect(pool.get(node3)).toBe(2);
            pool.remove(node1);

            expect(pool.get(node3)).toBe(0);
            expect(pool.values[0]).toBe(3);
        })

        it('after remove, get() returns new index for moved component', () => {
            const world: FlatWorld = new FlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 5);

            pool.add(node1);
            pool.add(node2);
            const preMoveId: number = pool.get(node2);
            pool.remove(node1);

            expect(pool.get(node2)).not.toEqual(preMoveId);
        })

        it('after swap, nodeIdAt() at swapped index returns the moved nodes id', () => {
            const world: FlatWorld = new FlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 5);

            expect(node1.id).not.toEqual(node2.id);
            pool.add(node1);
            pool.add(node2);
            expect(pool.nodeIdAt(0)).toBe(node1.id);
            pool.remove(node1);

            expect(pool.nodeIdAt(0)).toBe(node2.id);
        })

        it('removes last component, no swap needed, count decrements, data intact for other (edge case)', () => {
            const world: FlatWorld = new FlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 5);

            pool.add(node1);
            pool.add(node2);
            pool.add(node3);
            pool.values[0] = 1;
            pool.values[1] = 2;
            pool.values[2] = 3;
            expect(pool.count).toBe(3);
            pool.remove(node3);

            expect(pool.count).toBe(2);
            expect(pool.values[0]).toBe(1);
            expect(pool.values[1]).toBe(2);
        })

        it('Remove only component, count becomes 0', () => {
            const world: FlatWorld = new FlatWorld(10);
            const node: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 5);

            pool.add(node);
            expect(pool.count).toBe(1);
            pool.remove(node);

            expect(pool.count).toBe(0);
        })

        it('remove middle of three -> last moves into middle spot', () => {
            const world: FlatWorld = new FlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 5);

            pool.add(node1);
            pool.add(node2);
            pool.add(node3);
            pool.values[0] = 1;
            pool.values[1] = 2;
            pool.values[2] = 3;
            expect(pool.count).toBe(3);
            pool.remove(node2);

            expect(pool.values[0]).toBe(1);
            expect(pool.values[1]).toBe(3);
        })
    })

    describe('Error cases', () => {
        it('cannot add dead/stale ref', () => {
            const world: FlatWorld = new FlatWorld(10);
            const doomedNode: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 5);

            world.destroy(doomedNode);
            const reincarnatedNode = world.createNode();
            expect(doomedNode.id).toBe(reincarnatedNode.id);

            expect(() => pool.add(doomedNode)).toThrow("Stale node reference")
        })

        it('cannot add duplicate nodes (one component per node)', () => {
            const world: FlatWorld = new FlatWorld(10);
            const pool: TestPool = new TestPool(world, 5);

            pool.add(world.root);

            expect(() => pool.add(world.root)).toThrow("Node already has this component");
        })

        it('cannot add when at capacity', () => {
            const world: FlatWorld = new FlatWorld(10);
            const node: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 1);

            pool.add(world.root);

            expect(() => pool.add(node)).toThrow("Component pool at capacity");
        })

        it('cannot remove from node without component', () => {
            const world: FlatWorld = new FlatWorld(10);
            const node: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 5);

            expect(() => pool.remove(node)).toThrow("Node does not have this component");
        })

        it('cannot remove from dead/stale ref', () => {
            const world: FlatWorld = new FlatWorld(10);
            const doomedNode: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 5);

            pool.add(doomedNode);
            world.destroy(doomedNode);
            const reincarnatedNode: NodeHandle = world.createNode();
            expect(doomedNode.id).toBe(reincarnatedNode.id);

            expect(() => pool.remove(doomedNode)).toThrow("Stale node reference")
        })

        it('get throws when node doesnt have a component', () => {
            const world: FlatWorld = new FlatWorld(10);
            const node: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 5);

            expect(() => pool.get(node)).toThrow("Node does not have this component")
        })

        it('has returns false for node that doesnt have a component', () => {
            const world: FlatWorld = new FlatWorld(10);
            const node: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 5);

            expect(pool.has(node)).toBe(false);
        })

        it('nodeIdAt throws on out of bounds index', () => {
            const world: FlatWorld = new FlatWorld(10);
            const pool: TestPool = new TestPool(world, 5);

            expect(() => pool.nodeIdAt(-1)).toThrow("Index out of bounds");
            expect(() => pool.nodeIdAt(10)).toThrow("Index out of bounds");
        })
    })

    describe('world integration', () => {
        it('registerPool succeeds', () => {
            const world: FlatWorld = new FlatWorld(10);
            const pool: TestPool = new TestPool(world, 5);
            expect(() => world.registerPool(pool)).not.toThrow();
        })

        it('Cannot register the same pool twice', () => {
            const world: FlatWorld = new FlatWorld(10);
            const pool: TestPool = new TestPool(world, 5);

            world.registerPool(pool);

            expect(() => world.registerPool(pool)).toThrow("Pool already registered");
        })

        it('destroy removes components', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: NodeHandle = world.root;
            const node: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 5);
            world.registerPool(pool);

            world.attach(node, root)
            pool.add(node);
            expect(pool.count).toBe(1);
            world.destroy(node);

            expect(pool.count).toBe(0);
        })

        it('destroy subtree removes all descendent components', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: NodeHandle = world.root;
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 5);

            world.registerPool(pool);
            world.attach(node1, root);
            world.attach(node2, node1);
            world.attach(node3, node2);
            pool.add(node1);
            pool.add(node2);
            pool.add(node3);
            expect(pool.count).toBe(3);
            world.destroy(node1);

            expect(pool.count).toBe(0);
        })

        it('After destroy cleanup, freed spots are reusable', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: NodeHandle = world.root;
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 5);

            world.registerPool(pool);
            world.attach(node1, root);
            world.attach(node2, node1);
            world.attach(node3, node2);
            pool.add(node1);
            pool.add(node2);
            pool.add(node3);
            expect(pool.count).toBe(3);
            const doomedComponentIds: number[] = [pool.get(node1), pool.get(node2), pool.get(node3)];
            world.destroy(node1);

            const node4: NodeHandle = world.createNode();
            const node5: NodeHandle = world.createNode();
            const node6: NodeHandle = world.createNode();
            pool.add(node4);
            pool.add(node5);
            pool.add(node6);
            expect(pool.count).toBe(3);
            const reincarnatedComponentIds: number[] = [pool.get(node4), pool.get(node5), pool.get(node6)];

            expect(doomedComponentIds).toEqual(expect.arrayContaining(reincarnatedComponentIds));
            expect(doomedComponentIds).toHaveLength(reincarnatedComponentIds.length);
        })

        it('destroy with unregistered pool does not effect that pool', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: NodeHandle = world.root;
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 5);

            world.attach(node1, root);
            world.attach(node2, node1);
            pool.add(node1);
            pool.add(node2);
            expect(pool.count).toBe(2);
            world.destroy(node1);

            expect(pool.count).toBe(2);
        })

        it('Surviving nodes\' components unaffected after sibling destroyed', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: NodeHandle = world.root;
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const pool: TestPool = new TestPool(world, 5);

            world.registerPool(pool);
            world.attach(node1, root);
            world.attach(node2, root);
            pool.add(node1);
            pool.add(node2);
            expect(pool.count).toBe(2);
            world.destroy(node1);

            expect(pool.count).toBe(1);
            expect(pool.has(node2)).toBe(true);
        })
    })
})
