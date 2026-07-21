import {createFlatWorld} from "../FlatWorld";
import {NodeHandle, refEquals, FlatWorld} from "../types";

describe('basic world tests', () => {
    it('world creates valid root ref', () => {
         const world: FlatWorld = createFlatWorld(10);
         expect(() => world.assertValidRef(world.root)).not.toThrow();
    })

    it('createNode returns a valid ref', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();

        expect(() => world.assertValidRef(node)).not.toThrow();
    })

    it('stale ref fails after invalid', () => {
        const world: FlatWorld = createFlatWorld(10);
        const doomedNode: NodeHandle = world.createNode();
        world.destroy(doomedNode);
        const reincarnatedNode: NodeHandle = world.createNode();

        expect(doomedNode.id).toBe(reincarnatedNode.id);
        expect(() => world.assertValidRef(doomedNode)).toThrow("Stale node reference");
    })

    it('enabled defaults to true', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();

        expect(world.isEnabled(node)).toBe(true);
    })

    it('getParent gets parent', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();
        world.attach(node, world.root);

        expect(refEquals(world.getParent(node)!, world.root)).toBe(true);
    })

    it('getParent returns correct version', () => {
        const world: FlatWorld = createFlatWorld(10);
        const child: NodeHandle = world.createNode();
        const doomedParent: NodeHandle = world.createNode();
        world.destroy(doomedParent);
        const reincarnatedParent: NodeHandle = world.createNode();

        world.attach(child, reincarnatedParent);
        expect(reincarnatedParent.id).toBe(doomedParent.id);
        expect(reincarnatedParent.version).toBe(doomedParent.version + 1);
        expect(refEquals(world.getParent(child)!, reincarnatedParent)).toBe(true);
        expect(refEquals(world.getParent(child)!, doomedParent)).toBe(false);
    })

    it('getParent returns null for root', () => {
        const world: FlatWorld = createFlatWorld(10);

        expect(world.getParent(world.root)).toBeNull();
    })

    it('getParentFails for if reference is stale', () => {
        const world: FlatWorld = createFlatWorld(10);
        const doomedNode: NodeHandle = world.createNode();
        world.destroy(doomedNode);
        const reincarnatedNode: NodeHandle = world.createNode();

        expect(doomedNode.id).toBe(reincarnatedNode.id);
        expect(() => world.getParent(doomedNode)).toThrow("Stale node reference");
    })

    it('getChildren gets children', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();
        world.attach(node, world.root);

        expect(refEquals(world.getChildren(world.root)[0], node)).toBe(true);
    })

    it('getChildren returns correct version', () => {
        const world: FlatWorld = createFlatWorld(10);
        const parent: NodeHandle = world.createNode();
        const doomedChild: NodeHandle = world.createNode();
        world.destroy(doomedChild);
        const reincarnatedChild: NodeHandle = world.createNode();

        world.attach(reincarnatedChild, parent);
        expect(reincarnatedChild.id).toBe(doomedChild.id);
        expect(reincarnatedChild.version).toBe(doomedChild.version + 1);
        expect(refEquals(world.getChildren(parent)[0], reincarnatedChild)).toBe(true);
        expect(refEquals(world.getChildren(parent)[0], doomedChild)).toBe(false);
    })


    it('getChildren fails if reference is stale', () => {
        const world: FlatWorld = createFlatWorld(10);
        const doomedNode: NodeHandle = world.createNode();
        world.destroy(doomedNode);
        const reincarnatedNode: NodeHandle = world.createNode();

        expect(doomedNode.id).toBe(reincarnatedNode.id);
        expect(() => world.getChildren(doomedNode)).toThrow("Stale node reference");
    })

    it('isAlive returns alive for nodes that are part of the tee', () => {
        const world: FlatWorld = createFlatWorld(10);

        expect(world.isAlive(world.root)).toBe(true);
    })

    it('isAlive returns false for nodes that have been removed', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();

        expect(world.isAlive(node)).toBe(true);
        world.destroy(node);

        expect(world.isAlive(node)).toBe(false);
    })
})

describe('mutation tests', () => {
    it('attach set child parent', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();
        world.attach(node, world.root);

        expect(refEquals(world.getParent(node)!, world.root)).toBe(true);
    })

    it('attach inserts child into parents firstChild list', () => {
        const world: FlatWorld = createFlatWorld(10);
        const root: NodeHandle = world.root;
        const node: NodeHandle = world.createNode();
        world.attach(node, world.root);

        expect(refEquals(world.getChildren(root)[0], node)).toBe(true);
    })

    it('attaching inserts at the front', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node1: NodeHandle = world.createNode();
        const node2: NodeHandle = world.createNode();
        const node3: NodeHandle = world.createNode();

        world.attach(node1, world.root);
        world.attach(node2, world.root);
        world.attach(node3, world.root);
        const children: NodeHandle[] = world.getChildren(world.root);

        expect(refEquals(children[0], node3)).toBe(true);
        expect(refEquals(children[1], node2)).toBe(true);
        expect(refEquals(children[2], node1)).toBe(true);
    })

    it('detach clears parent', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();

        world.attach(node, world.root);
        world.detach(node);

        expect(world.getParent(node)).toBe(null);
    })

    it('detach removes first child correctly', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node1: NodeHandle = world.createNode();
        const node2: NodeHandle = world.createNode();
        const node3: NodeHandle = world.createNode();

        world.attach(node1, world.root);
        world.attach(node2, world.root);
        world.attach(node3, world.root);
        world.detach(node3);
        const children: NodeHandle[] = world.getChildren(world.root);

        expect(refEquals(children[0], node2)).toBe(true);
        expect(refEquals(children[1], node1)).toBe(true);
    })

    it('detach removes middle child correctly', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node1: NodeHandle = world.createNode();
        const node2: NodeHandle = world.createNode();
        const node3: NodeHandle = world.createNode();

        world.attach(node1, world.root);
        world.attach(node2, world.root);
        world.attach(node3, world.root);
        world.detach(node2);
        const children: NodeHandle[] = world.getChildren(world.root);

        expect(refEquals(children[0], node3)).toBe(true);
        expect(refEquals(children[1], node1)).toBe(true);
    })

    it('detach removes last child correctly', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node1: NodeHandle = world.createNode();
        const node2: NodeHandle = world.createNode();
        const node3: NodeHandle = world.createNode();

        world.attach(node1, world.root);
        world.attach(node2, world.root);
        world.attach(node3, world.root);
        world.detach(node1);
        const children: NodeHandle[] = world.getChildren(world.root);

        expect(refEquals(children[0], node3)).toBe(true);
        expect(refEquals(children[1], node2)).toBe(true);
    })

    it('detach removes only child correctly', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();
        world.attach(node, world.root);
        world.detach(node);

        expect(world.getParent(node)).toBe(null);
        expect(world.getChildren(world.root).length).toBe(0);
    })

    it("cannot attach a child that is stale", () => {
        const world: FlatWorld = createFlatWorld(10);
        const doomedNode: NodeHandle = world.createNode();

        world.destroy(doomedNode);
        const reincarnatedNode: NodeHandle = world.createNode();

        expect(doomedNode.id).toBe(reincarnatedNode.id);
        expect(() => world.attach(doomedNode, world.root)).toThrow("Stale node reference");
    });

    it('cannot attach root', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();
        world.attach(node, world.root);


        expect(() => world.attach(world.root, node)).toThrow("Cannot attach root");
    })

    it('cannot attach a node to itself', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();

        expect(() => world.attach(node, node)).toThrow("Cannot attach a node to itself");
    })

    it('cannot attach child with existing parent', () => {
        const world: FlatWorld = createFlatWorld(10);
        const root: NodeHandle = world.root;
        const node1: NodeHandle = world.createNode();
        const node2: NodeHandle = world.createNode();
        world.attach(node1, root);
        world.attach(node2, root);

        expect(() => world.attach(node2, node1)).toThrow("Child already has parent");
    })

    it('cannot attach a child to one of its descendants', () => {
        const world: FlatWorld = createFlatWorld(10);
        const root: NodeHandle = world.root;
        const node1: NodeHandle = world.createNode();
        const node2: NodeHandle = world.createNode();
        const node3: NodeHandle = world.createNode();

        world.attach(node2, node1);
        world.attach(node3, node2);

        expect(() => {world.attach(node1, node3)}).toThrow("Cannot create cycle")
    })

    it('cannot detach a stale reference', () => {
        const world: FlatWorld = createFlatWorld(10);
        const doomedNode: NodeHandle = world.createNode();

        world.destroy(doomedNode);
        const reincarnatedNode: NodeHandle = world.createNode();

        expect(doomedNode.id).toBe(reincarnatedNode.id);
        expect(() => world.detach(doomedNode)).toThrow("Stale node reference");
    })


    it('cannot detach root', () => {
        const world: FlatWorld = createFlatWorld(10);
        const root: NodeHandle = world.root;

        expect(() => world.detach(root)).toThrow("Cannot detach root")
    })

    it('cannot detach parentless node', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();

        expect(() => world.detach(node)).toThrow("Node has no parent");
    })
})
