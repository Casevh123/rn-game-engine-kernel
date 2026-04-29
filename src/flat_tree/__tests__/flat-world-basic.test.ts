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

    it('stale ref fails after node is freed/ reused', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node1: FlatNodeRef = world.createNode();
        world.storage.free(node1.id);
        const node2: FlatNodeRef = world.createNode();

        expect(() => world.assertValidRef(node1)).toThrow("Stale node reference");
    })

    it('enabled defaults to true', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: FlatNodeRef = world.createNode();

        expect(world.isEnabled(node)).toBe(true);
    })
})

describe('mutation tests', () => {
    it('attach set child parent', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: FlatNodeRef = world.createNode();
        world.attach(node, world.root);

        expect(world.storage.parent[node.id]).toBe(world.root.id);
    })

    it('attach inserts child into parents firstChild list', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: FlatNodeRef = world.createNode();
        world.attach(node, world.root);

        expect(world.storage.firstChild[ROOT_ID]).toBe(node.id);
    })

    it('attaching maintains next sibling / previous sibling links', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node1: FlatNodeRef = world.createNode();
        const node2: FlatNodeRef = world.createNode();
        const node3: FlatNodeRef = world.createNode();

        world.attach(node1, world.root);
        world.attach(node2, world.root);
        world.attach(node3, world.root);

        expect(world.storage.nextSibling[node2.id]).toBe(node1.id);
        expect(world.storage.prevSibling[node2.id]).toBe(node3.id);
    })

    it('attaching puts second child before old first child', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node1: FlatNodeRef = world.createNode();
        const node2: FlatNodeRef = world.createNode();

        world.attach(node1, world.root);
        expect(world.storage.firstChild[ROOT_ID]).toBe(node1.id);
        world.attach(node2, world.root);

        expect(world.storage.nextSibling[node2.id]).toBe(node1.id);
        expect(world.storage.prevSibling[node1.id]).toBe(node2.id);
        expect(world.storage.firstChild[ROOT_ID]).toBe(node2.id);
    })

    it('detach clears parent', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: FlatNodeRef = world.createNode();

        world.attach(node, world.root);
        world.detach(node);

        expect(world.storage.parent[node.id]).toBe(NULL);
    })

    it('detach removes first child correctly', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node1: FlatNodeRef = world.createNode();
        const node2: FlatNodeRef = world.createNode();
        const node3: FlatNodeRef = world.createNode();

        world.attach(node1, world.root);
        world.attach(node2, world.root);
        world.attach(node3, world.root);
        expect(world.storage.firstChild[ROOT_ID]).toBe(node3.id);
        world.detach(node3);

        expect(world.storage.firstChild[ROOT_ID]).toBe(node2.id);
    })

    it('detach removes middle child correctly', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node1: FlatNodeRef = world.createNode();
        const node2: FlatNodeRef = world.createNode();
        const node3: FlatNodeRef = world.createNode();

        world.attach(node1, world.root);
        world.attach(node2, world.root);
        world.attach(node3, world.root);
        expect(world.storage.nextSibling[node3.id]).toBe(node2.id);
        expect(world.storage.prevSibling[node1.id]).toBe(node2.id);
        world.detach(node2);

        expect(world.storage.nextSibling[node3.id]).toBe(node1.id);
        expect(world.storage.prevSibling[node1.id]).toBe(node3.id);
    })

    it('detach removes last child correctly', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node1: FlatNodeRef = world.createNode();
        const node2: FlatNodeRef = world.createNode();
        const node3: FlatNodeRef = world.createNode();

        world.attach(node1, world.root);
        world.attach(node2, world.root);
        world.attach(node3, world.root);
        expect(world.storage.nextSibling[node2.id]).toBe(node1.id);
        expect(world.storage.prevSibling[node1.id]).toBe(node2.id);
        world.detach(node1);

        expect(world.storage.nextSibling[node2.id]).toBe(NULL);
        expect(world.storage.prevSibling[node1.id]).toBe(NULL);
    })

    it('cannot attach root', () => {
        const world1: FlatWorld = new FlatWorld(10);
        const world2: FlatWorld = new FlatWorld(10);

        expect(() => world1.attach(world2.root, world1.root)).toThrow("Cannot attach root");
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
