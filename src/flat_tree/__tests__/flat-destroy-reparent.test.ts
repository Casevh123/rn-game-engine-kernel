import {createFlatWorld} from "../FlatWorld";
import {NodeHandle, refEquals, FlatWorld} from "../types";

describe('destroy', () => {
    describe('happy paths', () => {

        it('removes node from parent children list', () => {
            const world: FlatWorld = createFlatWorld(10);
            const root: NodeHandle = world.root;
            const child: NodeHandle = world.createNode();

            world.attach(child, root);
            expect(refEquals(world.getChildren(root)[0], child)).toBe(true);
            world.destroy(child);

            expect(world.getChildren(root).length).toBe(0);
        })

        it('isAlive() returns false for destroyed nodes', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node: NodeHandle = world.createNode();

            expect(world.isAlive(node)).toBe(true);
            world.destroy(node);
            expect(world.isAlive(node)).toBe(false);
        })

        it('can reallocate freed slot (world.createNode uses most recently destroyed spot)', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node1: NodeHandle = world.createNode();

            world.destroy(node1);
            const node2: NodeHandle = world.createNode();

            expect(node1.id).toBe(node2.id);
            expect(node1.version + 1).toBe(node2.version);
        })

        it('destroys all children recursively (works for deep subtree 3+ levels)', () => {
            const world: FlatWorld = createFlatWorld(10);
            const root: NodeHandle = world.root;
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();
            const node4: NodeHandle = world.createNode();
            const node5: NodeHandle = world.createNode();
            const node6: NodeHandle = world.createNode();

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
            const world: FlatWorld = createFlatWorld(10);
            const root: NodeHandle = world.root;
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();
            const node4: NodeHandle = world.createNode();
            const node5: NodeHandle = world.createNode();
            const node6: NodeHandle = world.createNode();
            const ids: number[] = [node1.id, node2.id, node3.id, node4.id, node5.id, node6.id];

            world.attach(node1, root);
            world.attach(node2, node1);
            world.attach(node3, node1);
            world.attach(node4, node3);
            world.attach(node5, node4);
            world.attach(node6, node5);
            world.destroy(node1);

            const node7: NodeHandle = world.createNode();
            const node8: NodeHandle = world.createNode();
            const node9: NodeHandle = world.createNode();
            const node10: NodeHandle = world.createNode();
            const node11: NodeHandle = world.createNode();
            const node12: NodeHandle = world.createNode();
            const newIds: number[] = [node7.id, node8.id, node9.id, node10.id, node11.id, node12.id];

            expect(newIds).toEqual(expect.arrayContaining(ids));
            expect(newIds).toHaveLength(ids.length);
        })

        it('destroy updates first child correctly', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();

            world.attach(node1, world.root);
            world.attach(node2, world.root);
            world.attach(node3, world.root);
            world.destroy(node3);
            const children: NodeHandle[] = world.getChildren(world.root);

            expect(refEquals(children[0], node2)).toBe(true);
            expect(refEquals(children[1], node1)).toBe(true);
        })

        it('destroy updates middle child correctly', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();

            world.attach(node1, world.root);
            world.attach(node2, world.root);
            world.attach(node3, world.root);
            world.destroy(node2);
            const children: NodeHandle[] = world.getChildren(world.root);

            expect(refEquals(children[0], node3)).toBe(true);
            expect(refEquals(children[1], node1)).toBe(true);
        })

        it('destroy updates last child correctly', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();

            world.attach(node1, world.root);
            world.attach(node2, world.root);
            world.attach(node3, world.root);
            world.destroy(node1);
            const children: NodeHandle[] = world.getChildren(world.root);

            expect(refEquals(children[0], node3)).toBe(true);
            expect(refEquals(children[1], node2)).toBe(true);
        })
    })

    describe('Error cases', () => {
        it('cannot destroy root', () => {
            const world: FlatWorld = createFlatWorld(10);

            expect(() => world.destroy(world.root)).toThrow("Cannot destroy root node");
        })

        it('cannot destroy stale references', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node1: NodeHandle = world.createNode();
            world.destroy(node1);
            const node2: NodeHandle = world.createNode();

            expect(node1.id).toBe(node2.id);
            expect(() => world.destroy(node1)).toThrow("Stale node reference");
        })
    })
})


describe('reparent', () => {
    describe('happy paths', () => {
        it('moves node from old parent to new parent', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();

            world.attach(node1, world.root);
            world.attach(node2, world.root);
            expect(refEquals(world.getParent(node1)!, world.root)).toBe(true);
            world.reparent(node1, node2);

            expect(refEquals(world.getParent(node1)!, node2)).toBe(true);
        })

        it('old parent no longer has child node and new parent does', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();

            world.attach(node1, world.root);
            world.attach(node2, world.root);
            world.attach(node3, node1);
            expect(world.getChildren(node1).length).toBe(1);
            expect(refEquals(world.getChildren(node1)[0], node3)).toBe(true);
            expect(world.getChildren(node2).length).toBe( 0);
            world.reparent(node3, node2);

            expect(world.getChildren(node1).length).toBe(0);
            expect(world.getChildren(node2).length).toBe(1);
            expect(refEquals(world.getChildren(node2)[0], node3)).toBe(true);
        })

        it('preserves children after reparent', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();
            const node4: NodeHandle = world.createNode();

            world.attach(node1, world.root);
            world.attach(node2, world.root);
            world.attach(node3, node1);
            world.attach(node4, node1);
            expect(refEquals(world.getChildren(node1)[0], node4)).toBe(true);
            expect(refEquals(world.getChildren(node1)[1], node3)).toBe(true);
            world.reparent(node1, node2);

            expect(refEquals(world.getChildren(node1)[0], node4)).toBe(true);
            expect(refEquals(world.getChildren(node1)[1], node3)).toBe(true);
        })

        it('preserves all descendants with deep subtree', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();
            const node4: NodeHandle = world.createNode();

            world.attach(node1, world.root);
            world.attach(node2, world.root);
            world.attach(node3, node1);
            world.attach(node4, node3);
            expect(refEquals(world.getChildren(node1)[0], node3)).toBe(true);
            expect(refEquals(world.getChildren(node3)[0], node4)).toBe(true);
            world.reparent(node1, node2);

            expect(refEquals(world.getChildren(node1)[0], node3)).toBe(true);
            expect(refEquals(world.getChildren(node3)[0], node4)).toBe(true);
        })

        it('first child — old parent firstChild updates', () => {
            const world: FlatWorld = createFlatWorld(10);
            const parent: NodeHandle = world.createNode();
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();

            world.attach(parent, world.root);
            world.attach(node1, parent);
            world.attach(node2, parent);
            world.attach(node3, parent);
            world.reparent(node3, world.root);
            const children: NodeHandle[] = world.getChildren(parent);

            expect(refEquals(children[0], node2)).toBe(true);
            expect(refEquals(children[1], node1)).toBe(true);
        })

        it('middle child — old parent siblings relink', () => {
            const world: FlatWorld = createFlatWorld(10);
            const parent: NodeHandle = world.createNode();
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();

            world.attach(parent, world.root);
            world.attach(node1, parent);
            world.attach(node2, parent);
            world.attach(node3, parent);
            world.reparent(node2, world.root);
            const children: NodeHandle[] = world.getChildren(parent);

            expect(refEquals(children[0], node3)).toBe(true);
            expect(refEquals(children[1], node1)).toBe(true);
        })

        it('last child — old parent list terminates', () => {
            const world: FlatWorld = createFlatWorld(10);
            const parent: NodeHandle = world.createNode();
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();

            world.attach(parent, world.root);
            world.attach(node1, parent);
            world.attach(node2, parent);
            world.attach(node3, parent);
            world.reparent(node1, world.root);
            const children: NodeHandle[] = world.getChildren(parent);

            expect(refEquals(children[0], node3)).toBe(true);
            expect(refEquals(children[1], node2)).toBe(true);
        })

        it('makes reparented node head of new parent child list and shifts down previous children', () => {
            const world: FlatWorld = createFlatWorld(10);
            const parent: NodeHandle = world.createNode();
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();

            world.attach(parent, world.root);
            world.attach(node1, world.root);
            world.attach(node2, parent);
            expect(refEquals(world.getChildren(parent)[0], node2)).toBe(true);
            world.reparent(node1, parent);

            expect(refEquals(world.getChildren(parent)[0], node1)).toBe(true);
            expect(refEquals(world.getChildren(parent)[1], node2)).toBe(true);
        })
    })

    describe('error cases', () => {
        it('cannot reparent root', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node1: NodeHandle = world.createNode();
            world.attach(node1, world.root);

            expect(() => world.reparent(world.root, node1)).toThrow("Cannot reparent root node");
        })

        it('cannot reparent stale node ref', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();

            world.attach(node1, world.root);
            world.attach(node2, world.root);
            world.destroy(node2);
            world.createNode();

            expect(() => world.reparent(node2, node1)).toThrow("Stale node reference");
        })

        it('cannot reparent stale parent ref', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();

            world.attach(node1, world.root);
            world.attach(node2, world.root);
            world.destroy(node1);
            world.createNode();

            expect(() => world.reparent(node2, node1)).toThrow("Stale node reference");
        })

        it('cannot reparent a node to itself', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node: NodeHandle = world.createNode();

            world.attach(node, world.root);

            expect(() => world.reparent(node, node)).toThrow("Cannot attach a node to itself");
        })

        it('cannot reparent parentless node', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node: NodeHandle = world.createNode();

            expect(() => world.reparent(node, world.root)).toThrow("Node does not have a parent, use attach instead");
        })

        it('cannot reparent to own child', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();

            world.attach(node1, world.root);
            world.attach(node2, node1);

            expect(() => world.reparent(node1, node2)).toThrow("Cannot create cycle");
        })

        it('cannot reparent to own grandchild', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();

            world.attach(node1, world.root);
            world.attach(node2, node1);
            world.attach(node3, node2);

            expect(() => world.reparent(node1, node3)).toThrow("Cannot create cycle");
        })

        it('cannot reparent to own to deep descendant', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();
            const node4: NodeHandle = world.createNode();

            world.attach(node1, world.root);
            world.attach(node2, node1);
            world.attach(node3, node2);
            world.attach(node4, node3);

            expect(() => world.reparent(node1, node4)).toThrow("Cannot create cycle");
        })

        it('cannot reparent to own parent', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node1: NodeHandle = world.createNode();

            world.attach(node1, world.root);

            expect(() => world.reparent(node1, world.root)).toThrow("Cannot reparent to current parent");
        })
    })

    describe('edge cases', () => {
        it('doesnt change enabled status', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();

            world.attach(node1, world.root);
            world.attach(node2, world.root);
            expect(world.isEnabled(node2)).toBe(true);
            world.reparent(node2, node1);

            expect(world.isEnabled(node2)).toBe(true);
        })

        it('doesnt change node version', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();

            world.attach(node1, world.root);
            world.attach(node2, world.root);
            world.reparent(node2, node1);

            expect(() => world.assertValidRef(node2)).not.toThrow();
        })
    })
})
