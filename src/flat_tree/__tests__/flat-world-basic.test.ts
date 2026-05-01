import {FlatWorld} from "../FlatWorld";
import {FlatNodeRef} from "../FlatNodeRef";
import {NULL, ROOT_ID} from "../constants";

describe('basic world tests', () => {
    it('world creates valid root ref', () => {
         const world: FlatWorld = new FlatWorld(10);
         expect(() => world.assertValidRef(world.root)).not.toThrow();
    })

    it('createNode returns a valid ref', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: FlatNodeRef = world.createNode();

        expect(() => world.assertValidRef(node)).not.toThrow();
    })

    it.todo('stale ref fails after invalid')

    it('enabled defaults to true', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: FlatNodeRef = world.createNode();

        expect(world.isEnabled(node)).toBe(true);
    })

    it('getParent gets parent', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: FlatNodeRef = world.createNode();
        world.attach(node, world.root);

        expect(world.getParent(node)?.equals(world.root)).toBe(true);
    })

    it.todo('getParent returns correct version')

    it('getParent returns null for root', () => {
        const world: FlatWorld = new FlatWorld(10);

        expect(world.getParent(world.root)).toBeNull();
    })

    it.todo('getParentFails for if reference is stale')

    it('getParent fails if node does not belong to world', () => {
        const world1: FlatWorld = new FlatWorld(10);
        const world2: FlatWorld = new FlatWorld(10);
        const node: FlatNodeRef = world1.createNode();
        world1.attach(node, world1.root);

        expect(() => world2.getParent(node)).toThrow("Node does not belong to this world")
    })

    it('getChildren gets children', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: FlatNodeRef = world.createNode();
        world.attach(node, world.root);

        expect(world.getChildren(world.root)[0].equals(node)).toBe(true);
    })

    it.todo('getChildren returns correct version')


    it.todo('getChildren fails if reference is stale')

    it('getChildren fails if node does not belong to world', () => {
        const world1: FlatWorld = new FlatWorld(10);
        const world2: FlatWorld = new FlatWorld(10);
        const node: FlatNodeRef = world1.createNode();
        world1.attach(node, world1.root);

        expect(() => world2.getChildren(world1.root)).toThrow("Node does not belong to this world")
    })

    it('isAlive returns alive for nodes that are part of the tee', () => {
        const world: FlatWorld = new FlatWorld(10);

        expect(world.isAlive(world.root)).toBe(true);
    })

    it.todo('isAlive returns false for nodes that have just been removed')

    it.todo('isAlive fails if reference is stale')

    it('isAlive fails if node does not belong to world', () => {
        const world1: FlatWorld = new FlatWorld(10);
        const world2: FlatWorld = new FlatWorld(10);

        expect(() => world1.isAlive(world2.root)).toThrow("Node does not belong to this world")
    })
})

describe('mutation tests', () => {
    it('attach set child parent', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: FlatNodeRef = world.createNode();
        world.attach(node, world.root);

        expect(world.getParent(node)?.equals(world.root)).toBe(true);
    })

    it('attach inserts child into parents firstChild list', () => {
        const world: FlatWorld = new FlatWorld(10);
        const root: FlatNodeRef = world.root;
        const node: FlatNodeRef = world.createNode();
        world.attach(node, world.root);

        expect(world.getChildren(root)[0].equals(node)).toBe(true);
    })

    it('attaching inserts at the front', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node1: FlatNodeRef = world.createNode();
        const node2: FlatNodeRef = world.createNode();
        const node3: FlatNodeRef = world.createNode();

        world.attach(node1, world.root);
        world.attach(node2, world.root);
        world.attach(node3, world.root);
        const children: FlatNodeRef[] = world.getChildren(world.root);

        expect(children[0].equals(node3)).toBe(true);
        expect(children[1].equals(node2)).toBe(true);
        expect(children[2].equals(node1)).toBe(true);
    })

    it('detach clears parent', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: FlatNodeRef = world.createNode();

        world.attach(node, world.root);
        world.detach(node);

        expect(world.getParent(node)).toBe(null);
    })

    it('detach removes first child correctly', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node1: FlatNodeRef = world.createNode();
        const node2: FlatNodeRef = world.createNode();
        const node3: FlatNodeRef = world.createNode();

        world.attach(node1, world.root);
        world.attach(node2, world.root);
        world.attach(node3, world.root);
        world.detach(node3);
        const children: FlatNodeRef[] = world.getChildren(world.root);

        expect(children[0].equals(node2)).toBe(true);
        expect(children[1].equals(node1)).toBe(true);
    })

    it('detach removes middle child correctly', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node1: FlatNodeRef = world.createNode();
        const node2: FlatNodeRef = world.createNode();
        const node3: FlatNodeRef = world.createNode();

        world.attach(node1, world.root);
        world.attach(node2, world.root);
        world.attach(node3, world.root);
        world.detach(node2);
        const children: FlatNodeRef[] = world.getChildren(world.root);

        expect(children[0].equals(node3)).toBe(true);
        expect(children[1].equals(node1)).toBe(true);
    })

    it('detach removes last child correctly', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node1: FlatNodeRef = world.createNode();
        const node2: FlatNodeRef = world.createNode();
        const node3: FlatNodeRef = world.createNode();

        world.attach(node1, world.root);
        world.attach(node2, world.root);
        world.attach(node3, world.root);
        world.detach(node1);
        const children: FlatNodeRef[] = world.getChildren(world.root);

        expect(children[0].equals(node3)).toBe(true);
        expect(children[1].equals(node2)).toBe(true);
    })

    it('detach removes only child correctly', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: FlatNodeRef = world.createNode();
        world.attach(node, world.root);
        world.detach(node);

        expect(world.getParent(node)).toBe(null);
        expect(world.getChildren(world.root).length).toBe(0);
    })

    it('cannot attach if child or parent is not in the world', () => {
        const world1: FlatWorld = new FlatWorld(10);
        const world2: FlatWorld = new FlatWorld(10);
        const node1: FlatNodeRef = world1.createNode();
        const node2: FlatNodeRef = world2.createNode();
        world1.attach(node1, world1.root);
        world2.attach(node2, world2.root);

        expect(() => world1.attach(node2, node1)).toThrow("Node does not belong to this world");
        expect(() => world1.attach(node1, node2)).toThrow("Node does not belong to this world");
    })

    it.todo("cannot attach a child that is stale");

    it('cannot attach root', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: FlatNodeRef = world.createNode();
        world.attach(node, world.root);


        expect(() => world.attach(world.root, node)).toThrow("Cannot attach root");
    })

    it('cannot attach a node to itself', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: FlatNodeRef = world.createNode();

        expect(() => world.attach(node, node)).toThrow("Cannot attach a node to itself");
    })

    it('cannot attach child with existing parent', () => {
        const world: FlatWorld = new FlatWorld(10);
        const root: FlatNodeRef = world.root;
        const node1: FlatNodeRef = world.createNode();
        const node2: FlatNodeRef = world.createNode();
        world.attach(node1, root);
        world.attach(node2, root);

        expect(() => world.attach(node2, node1)).toThrow("Child already has parent");
    })

    it('cannot detach a node that doesnt belong to the world', () => {
        const world1: FlatWorld = new FlatWorld(10);
        const world2: FlatWorld = new FlatWorld(10);
        const node: FlatNodeRef = world2.createNode();
        world2.attach(node, world2.root);

        expect(() => world1.detach(node)).toThrow("Node does not belong to this world");
    })

    it.todo('cannot detach a stale reference')

    it('cannot detach root', () => {
        const world: FlatWorld = new FlatWorld(10);
        const root: FlatNodeRef = world.root;

        expect(() => world.detach(root)).toThrow("Cannot detach root")
    })

    it('cannot detach parentless node', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: FlatNodeRef = world.createNode();

        expect(() => world.detach(node)).toThrow("Node has no parent");
    })
})
