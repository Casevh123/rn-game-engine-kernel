import {FlatWorld} from "../FlatWorld";
import {FlatNodeRef} from "../FlatNodeRef";

describe('destroy', () => {
    describe('happy paths', () => {

        it('removes node from parent children list', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: FlatNodeRef = world.root;
            const child: FlatNodeRef = world.createNode();

            world.attach(child, root);
            expect(world.getChildren(root)[0].equals(child)).toBe(true);
            world.destroy(child);

            expect(world.getChildren(root).length).toBe(0);
        })

        it('isAlive() returns false for destroyed nodes', () => {
            const world: FlatWorld = new FlatWorld(10);
            const node: FlatNodeRef = world.createNode();

            expect(world.isAlive(node)).toBe(true);
            world.destroy(node);
            expect(world.isAlive(node)).toBe(false);
        })

        it('can reallocate freed slot (world.createNode uses most recently destroyed spot)', () => {
            const world: FlatWorld = new FlatWorld(10);
            const node1: FlatNodeRef = world.createNode();

            world.destroy(node1);
            const node2: FlatNodeRef = world.createNode();

            expect(node1.id).toBe(node2.id);
            expect(node1.version + 1).toBe(node2.version);
        })

        it('destroys all children recursively (works for deep subtree 3+ levels)', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: FlatNodeRef = world.root;
            const node1: FlatNodeRef = world.createNode();
            const node2: FlatNodeRef = world.createNode();
            const node3: FlatNodeRef = world.createNode();
            const node4: FlatNodeRef = world.createNode();
            const node5: FlatNodeRef = world.createNode();
            const node6: FlatNodeRef = world.createNode();

            world.attach(node1, root);
            world.attach(node2, node1);
            world.attach(node3, node1);
            world.attach(node4, node3);
            world.attach(node5, node4);
            world.attach(node6, node5);

            expect(world.isAlive(node1)).toBe(true);
            expect(world.isAlive(node2)).toBe(true);
            expect(world.isAlive(node3)).toBe(true);
            expect(world.isAlive(node4)).toBe(true);
            expect(world.isAlive(node5)).toBe(true);
            expect(world.isAlive(node6)).toBe(true);
            world.destroy(node1);
            expect(world.isAlive(node1)).toBe(false);
            expect(world.isAlive(node2)).toBe(false);
            expect(world.isAlive(node3)).toBe(false);
            expect(world.isAlive(node4)).toBe(false);
            expect(world.isAlive(node5)).toBe(false);
            expect(world.isAlive(node6)).toBe(false);
        })

        it('can reuse all destroyed descendants', () => {
            const world: FlatWorld = new FlatWorld(10);
            const root: FlatNodeRef = world.root;
            const node1: FlatNodeRef = world.createNode();
            const node2: FlatNodeRef = world.createNode();
            const node3: FlatNodeRef = world.createNode();
            const node4: FlatNodeRef = world.createNode();
            const node5: FlatNodeRef = world.createNode();
            const node6: FlatNodeRef = world.createNode();
            const ids: number[] = [node1.id, node2.id, node3.id, node4.id, node5.id, node6.id];

            world.attach(node1, root);
            world.attach(node2, node1);
            world.attach(node3, node1);
            world.attach(node4, node3);
            world.attach(node5, node4);
            world.attach(node6, node5);
            world.destroy(node1);

            const node7: FlatNodeRef = world.createNode();
            const node8: FlatNodeRef = world.createNode();
            const node9: FlatNodeRef = world.createNode();
            const node10: FlatNodeRef = world.createNode();
            const node11: FlatNodeRef = world.createNode();
            const node12: FlatNodeRef = world.createNode();
            const newIds: number[] = [node7.id, node8.id, node9.id, node10.id, node11.id, node12.id];

            expect(newIds).toEqual(expect.arrayContaining(ids));
            expect(newIds).toHaveLength(ids.length);
        })

        it('destroy updates first child correctly', () => {
            const world: FlatWorld = new FlatWorld(10);
            const node1: FlatNodeRef = world.createNode();
            const node2: FlatNodeRef = world.createNode();
            const node3: FlatNodeRef = world.createNode();

            world.attach(node1, world.root);
            world.attach(node2, world.root);
            world.attach(node3, world.root);
            world.destroy(node3);
            const children: FlatNodeRef[] = world.getChildren(world.root);

            expect(children[0].equals(node2)).toBe(true);
            expect(children[1].equals(node1)).toBe(true);
        })

        it('destroy updates middle child correctly', () => {
            const world: FlatWorld = new FlatWorld(10);
            const node1: FlatNodeRef = world.createNode();
            const node2: FlatNodeRef = world.createNode();
            const node3: FlatNodeRef = world.createNode();

            world.attach(node1, world.root);
            world.attach(node2, world.root);
            world.attach(node3, world.root);
            world.destroy(node2);
            const children: FlatNodeRef[] = world.getChildren(world.root);

            expect(children[0].equals(node3)).toBe(true);
            expect(children[1].equals(node1)).toBe(true);
        })

        it('destroy updates last child correctly', () => {
            const world: FlatWorld = new FlatWorld(10);
            const node1: FlatNodeRef = world.createNode();
            const node2: FlatNodeRef = world.createNode();
            const node3: FlatNodeRef = world.createNode();

            world.attach(node1, world.root);
            world.attach(node2, world.root);
            world.attach(node3, world.root);
            world.destroy(node1);
            const children: FlatNodeRef[] = world.getChildren(world.root);

            expect(children[0].equals(node3)).toBe(true);
            expect(children[1].equals(node2)).toBe(true);
        })
    })

    describe('Error cases', () => {
        it('cannot destroy root', () => {
            const world: FlatWorld = new FlatWorld(10);

            expect(() => world.destroy(world.root)).toThrow("Cannot destroy root node");
        })

        it('cannot destroy stale references', () => {
            const world: FlatWorld = new FlatWorld(10);
            const node1: FlatNodeRef = world.createNode();
            world.destroy(node1);
            const node2: FlatNodeRef = world.createNode();

            expect(node1.id).toBe(node2.id);
            expect(() => world.destroy(node1)).toThrow("Stale node reference");
        })

        it('cannot destroy cross-world references', () => {
            const world1: FlatWorld = new FlatWorld(10);
            const world2: FlatWorld = new FlatWorld(10);
            const node1: FlatNodeRef = world1.createNode();
            const node2: FlatNodeRef = world2.createNode();

            expect(() => world1.destroy(node2)).toThrow("Node does not belong to this world");
        })
    })
})
