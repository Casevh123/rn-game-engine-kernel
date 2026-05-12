import {FlatWorld} from "../FlatWorld";
import {NodeHandle} from "../types";
import {FlatTreeStorage} from "../FlatTreeStorage";

describe('storage initialization', () => {
    it('new node has identity local transform', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: NodeHandle = world.createNode();

        expect(world.getLocalTransform(node)).toEqual({a: 1, b: 0, tx: 0, ty: 0});
    })

    it('new node has identity world transform', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: NodeHandle = world.createNode();

        expect(world.getWorldTransform(node)).toEqual({a: 1, b: 0, tx: 0, ty: 0});
    })

    it('root has identity local transform', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: NodeHandle = world.root;

        expect(world.getLocalTransform(node)).toEqual({a: 1, b: 0, tx: 0, ty: 0});
    })

    it('root has identity world transform', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: NodeHandle = world.root;

        expect(world.getWorldTransform(node)).toEqual({a: 1, b: 0, tx: 0, ty: 0});
    })

    it('Destroyed and reallocated slot has identity local transform', () => {
        const world: FlatWorld = new FlatWorld(10);
        const doomedNode: NodeHandle = world.createNode();

        world.setLocalTransform(doomedNode, 10, 10, 10, 10);
        world.destroy(doomedNode);
        const reincarnatedNode: NodeHandle = world.createNode();
        expect(reincarnatedNode.id).toEqual(doomedNode.id);
        expect(reincarnatedNode.version).toEqual(doomedNode.version + 1);

        expect(world.getLocalTransform(reincarnatedNode)).toEqual({a: 1, b: 0, tx: 0, ty: 0});
    })

    it('Destroyed and reallocated slot has identity world transform', () => {
        const storage: FlatTreeStorage = new FlatTreeStorage(10);
        const doomedNode: {id: number, version: number} = storage.allocate();

        storage.worldA[doomedNode.id] = 10;
        storage.worldB[doomedNode.id] = 10;
        storage.worldTx[doomedNode.id] = 10;
        storage.worldTy[doomedNode.id] = 10;
        storage.free(doomedNode.id);
        const reincarnatedNode: {id: number, version: number} = storage.allocate();
        expect(reincarnatedNode.id).toEqual(doomedNode.id);
        expect(reincarnatedNode.version).toEqual(doomedNode.version + 1);

        expect(storage.worldA[reincarnatedNode.id]).toEqual(1);
        expect(storage.worldB[reincarnatedNode.id]).toEqual(0);
        expect(storage.worldTx[reincarnatedNode.id]).toEqual(0);
        expect(storage.worldTy[reincarnatedNode.id]).toEqual(0);
    })
})

describe('Accessor validation', () => {
    it('setLocalTransform sets all 4 values correctly', () => {
        const world: FlatWorld = new FlatWorld(10);
        const storage: FlatTreeStorage = world.getStorage();
        const node: NodeHandle = world.createNode();

        world.setLocalTransform(node, 10, 10, 10, 10);

        expect(storage.localA[node.id]).toEqual(10);
        expect(storage.localB[node.id]).toEqual(10);
        expect(storage.localTx[node.id]).toEqual(10);
        expect(storage.localTy[node.id]).toEqual(10);
    })

    it('getLocalTransform gets the correct value', () => {
        const world: FlatWorld = new FlatWorld(10);
        const storage: FlatTreeStorage = world.getStorage();
        const node: NodeHandle = world.createNode();

        storage.localA[node.id] = 10;
        storage.localB[node.id] = 10;
        storage.localTx[node.id] = 10;
        storage.localTy[node.id] = 10;

        expect(world.getLocalTransform(node)).toEqual({a: 10, b: 10, tx: 10, ty: 10});
    })

    it('getWorldTransform gets the correct value', () => {
        const world: FlatWorld = new FlatWorld(10);
        const storage: FlatTreeStorage = world.getStorage();
        const node: NodeHandle = world.createNode();

        storage.worldA[node.id] = 10;
        storage.worldB[node.id] = 10;
        storage.worldTx[node.id] = 10;
        storage.worldTy[node.id] = 10;

        expect(world.getWorldTransform(node)).toEqual({a: 10, b: 10, tx: 10, ty: 10});
    })

    it('setLocalTransform rejects stale ref', () => {
        const world: FlatWorld = new FlatWorld(10);
        const doomedNode: NodeHandle = world.createNode();
        world.destroy(doomedNode);
        const reincarnatedNode: NodeHandle = world.createNode();

        expect(reincarnatedNode.id).toEqual(doomedNode.id);
        expect(reincarnatedNode.version).toEqual(doomedNode.version + 1);

        expect(() => world.setLocalTransform(doomedNode, 10, 10, 10, 10)).toThrow("Stale node reference");
    })

    it('getLocalTransform rejects stale ref', () => {
        const world: FlatWorld = new FlatWorld(10);
        const doomedNode: NodeHandle = world.createNode();
        world.destroy(doomedNode);
        const reincarnatedNode: NodeHandle = world.createNode();

        expect(reincarnatedNode.id).toEqual(doomedNode.id);
        expect(reincarnatedNode.version).toEqual(doomedNode.version + 1);

        expect(() => world.getLocalTransform(doomedNode)).toThrow("Stale node reference");
    })

    it('getWorldTransform rejects stale ref', () => {
        const world: FlatWorld = new FlatWorld(10);
        const doomedNode: NodeHandle = world.createNode();
        world.destroy(doomedNode);
        const reincarnatedNode: NodeHandle = world.createNode();

        expect(reincarnatedNode.id).toEqual(doomedNode.id);
        expect(reincarnatedNode.version).toEqual(doomedNode.version + 1);

        expect(() => world.getWorldTransform(doomedNode)).toThrow("Stale node reference");
    })
})

describe('setLocalPosition convenience', () => {
    it('setLocalPosition sets tx, ty correctly', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: NodeHandle = world.createNode();

        world.setLocalPosition(node, 10, 10);

        expect(world.getLocalTransform(node)).toEqual({a: 1, b: 0, tx: 10, ty: 10})
    })

    it('setLocalPosition does not modify a, b', () => {
        const world: FlatWorld = new FlatWorld(10);
        const node: NodeHandle = world.createNode();

        world.setLocalTransform(node, 1, 1, 1, 1);
        world.setLocalPosition(node, 10, 10);

        expect(world.getLocalTransform(node)).toEqual({a: 1, b: 1, tx: 10, ty: 10})
    })

    it('setLocalTransform rejects stale ref', () => {
        const world: FlatWorld = new FlatWorld(10);
        const doomedNode: NodeHandle = world.createNode();
        world.destroy(doomedNode);
        const reincarnatedNode: NodeHandle = world.createNode();

        expect(reincarnatedNode.id).toEqual(doomedNode.id);
        expect(reincarnatedNode.version).toEqual(doomedNode.version + 1);

        expect(() => world.setLocalPosition(doomedNode, 10, 10)).toThrow("Stale node reference");
    })
})
