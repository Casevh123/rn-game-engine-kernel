import {ComponentPool, FlatWorld, NodeHandle, SpriteAtlasLookup, System} from "../types";
import {createFlatWorld} from "../FlatWorld";
import {createSpritePool, SpritePoolResult} from "../SpritePool";

function createUniformPivotAtlas(numTypes: number, width: number = 0, height: number = 0, pivotX: number = 0, pivotY: number = 0): SpriteAtlasLookup {
    return {
        widths: new Float32Array(numTypes).fill(width),
        heights: new Float32Array(numTypes).fill(height),
        pivotXs: new Float32Array(numTypes).fill(pivotX),
        pivotYs: new Float32Array(numTypes).fill(pivotY),
    }
}

describe('render collection tests', () => {
    it('empty scene', () => {
        const world: FlatWorld = createFlatWorld(1024);
        const { pool: spritePool } = createSpritePool(world, 1);
        world.registerPool(spritePool)


        expect(spritePool.count).toBe(0);
    })

    it('single sprite', () => {
        const world: FlatWorld = createFlatWorld(1024);
        const { pool: spritePool, spriteType } = createSpritePool(world, 1);
        world.registerPool(spritePool)
        const node: NodeHandle = world.createNode();
        world.attach(node, world.root);
        spritePool.add(node);
        const atlas: SpriteAtlasLookup = createUniformPivotAtlas(16);
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType, atlas);
        const transformPropagate: System = world.createTransformPropagationSystem();
        world.addSystem(transformPropagate);
        world.addSystem(renderCollect);
        world.setLocalPosition(node, 100, 200);

        world.step(0);

        expect(buffer.count).toBe(1);
        expect(buffer.transforms).toEqual(new Float32Array([1, 0, 100, 200]));
    })

    it('multiple sprites', () => {
        const world: FlatWorld = createFlatWorld(1024);
        const { pool: spritePool, spriteType } = createSpritePool(world, 3);
        world.registerPool(spritePool)
        const nodeA: NodeHandle = world.createNode();
        const nodeB: NodeHandle = world.createNode();
        const nodeC: NodeHandle = world.createNode();
        world.attach(nodeA, world.root);
        world.attach(nodeB, world.root);
        world.attach(nodeC, world.root);
        spritePool.add(nodeA);
        spritePool.add(nodeB);
        spritePool.add(nodeC);
        const atlas: SpriteAtlasLookup = createUniformPivotAtlas(16);
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType, atlas);
        const transformPropagate: System = world.createTransformPropagationSystem();
        world.addSystem(transformPropagate);
        world.addSystem(renderCollect);
        world.setLocalPosition(nodeA, 100, 200);
        world.setLocalPosition(nodeB, 50, 0);
        world.setLocalPosition(nodeC, 21, 32);

        world.step(0);

        expect(buffer.count).toBe(3);
        expect(buffer.transforms).toEqual(new Float32Array([1, 0, 100, 200, 1, 0, 50, 0, 1, 0, 21, 32]));
    })

    it('Disabled sprite', () => {
        const world: FlatWorld = createFlatWorld(1024);
        const { pool: spritePool, spriteType } = createSpritePool(world, 1);
        world.registerPool(spritePool)
        const node: NodeHandle = world.createNode();
        world.attach(node, world.root);
        spritePool.add(node);
        const atlas: SpriteAtlasLookup = createUniformPivotAtlas(16);
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType, atlas);
        const transformPropagate: System = world.createTransformPropagationSystem();
        world.addSystem(transformPropagate);
        world.addSystem(renderCollect);
        world.setLocalPosition(node, 100, 200);
        world.setEnabled(node, false);

        world.step(0);

        expect(buffer.count).toBe(0);
        expect(buffer.transforms).toEqual(new Float32Array([0, 0, 0, 0]));
    })

    it('Parent disabled (worldEnabled)', () => {
        const world: FlatWorld = createFlatWorld(1024);
        const { pool: spritePool, spriteType } = createSpritePool(world, 1);
        world.registerPool(spritePool)
        const parent: NodeHandle = world.createNode();
        const node: NodeHandle = world.createNode();
        world.attach(parent, world.root);
        world.attach(node, parent);
        spritePool.add(node);
        const atlas: SpriteAtlasLookup = createUniformPivotAtlas(16);
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType, atlas);
        const transformPropagate: System = world.createTransformPropagationSystem();
        world.addSystem(transformPropagate);
        world.addSystem(renderCollect);
        world.setLocalPosition(node, 100, 200);
        world.setEnabled(parent, false);

        world.step(0);
        expect(buffer.count).toBe(0);
        expect(buffer.transforms).toEqual(new Float32Array([0, 0, 0, 0]));
        world.setEnabled(parent, true);
        world.step(0);

        expect(buffer.count).toBe(1);
        expect(buffer.transforms).toEqual(new Float32Array([1, 0, 100, 200]));
    })

    it('Sprite type in buffer', () => {
        const world: FlatWorld = createFlatWorld(1024);
        const { pool: spritePool, spriteType } = createSpritePool(world, 1);
        world.registerPool(spritePool)
        const node: NodeHandle = world.createNode();
        world.attach(node, world.root);
        spritePool.add(node);
        spriteType[spritePool.get(node)] = 5
        const atlas: SpriteAtlasLookup = createUniformPivotAtlas(16);
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType, atlas);
        const transformPropagate: System = world.createTransformPropagationSystem();
        world.addSystem(transformPropagate);
        world.addSystem(renderCollect);

        world.step(0);

        expect(buffer.count).toBe(1);
        expect(buffer.spriteTypes[0]).toBe(5);
    })

    it('Destroyed node with sprite not in buffer', () => {
        const world: FlatWorld = createFlatWorld(1024);
        const { pool: spritePool, spriteType } = createSpritePool(world, 1);
        world.registerPool(spritePool)
        const node: NodeHandle = world.createNode();
        world.attach(node, world.root);
        spritePool.add(node);
        const atlas: SpriteAtlasLookup = createUniformPivotAtlas(16);
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType, atlas);
        const transformPropagate: System = world.createTransformPropagationSystem();
        world.addSystem(transformPropagate);
        world.addSystem(renderCollect);
        world.setLocalPosition(node, 100, 200);

        world.step(0);
        expect(buffer.count).toBe(1);
        world.destroy(node);
        world.step(0);

        expect(buffer.count).toBe(0);
    })

    it('buffer reuse', () => {
        const world: FlatWorld = createFlatWorld(1024);
        const { pool: spritePool, spriteType } = createSpritePool(world, 1);
        world.registerPool(spritePool)
        const atlas: SpriteAtlasLookup = createUniformPivotAtlas(16);
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType, atlas);
        const transformPropagate: System = world.createTransformPropagationSystem();
        world.addSystem(transformPropagate);
        world.addSystem(renderCollect);
        const bufferRef = buffer;

        world.step(0);
        expect(buffer.count).toBe(0);
        const node: NodeHandle = world.createNode();
        world.attach(node, world.root);
        spritePool.add(node);
        world.step(0);

        expect(buffer.count).toBe(1);
        expect(buffer).toEqual(bufferRef);
    })

    it('Hierarchy test', () => {
        const world: FlatWorld = createFlatWorld(1024);
        const { pool: spritePool, spriteType } = createSpritePool(world, 1);
        world.registerPool(spritePool)
        const parent: NodeHandle = world.createNode();
        const node: NodeHandle = world.createNode();
        world.attach(parent, world.root);
        world.attach(node, parent);
        spritePool.add(node);
        const atlas: SpriteAtlasLookup = createUniformPivotAtlas(16);
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType, atlas);
        const transformPropagate: System = world.createTransformPropagationSystem();
        world.addSystem(transformPropagate);
        world.addSystem(renderCollect);
        world.setLocalPosition(node, 100, 200);
        world.setLocalPosition(parent, 0, 200);

        world.step(0);
        expect(buffer.count).toBe(1);
        expect(buffer.transforms).toEqual(new Float32Array([1, 0, 100, 400]));
    })
})

describe('Pivot correction', () => {
    let world: FlatWorld;
    let spritePool: ComponentPool;
    let spriteType: Int32Array;
    let node: NodeHandle;

    beforeEach(() => {
        const _world = createFlatWorld(1024);
        const _result: SpritePoolResult = createSpritePool(_world, 2);
        const _spritePool = _result.pool;
        const _spriteType = _result.spriteType;
        _world.registerPool(_spritePool);
        const _node = _world.createNode();

        _world.attach(_node, _world.root);
        _spritePool.add(_node);
        const _transformPropagate = _world.createTransformPropagationSystem();
        _world.addSystem(_transformPropagate);

        world = _world;
        spritePool = _spritePool;
        spriteType = _spriteType;
        node = _node;
    });

    it('center pivot, no rotation', () => {
        const atlas: SpriteAtlasLookup = createUniformPivotAtlas(16, 64, 64, 0.5, 0.5);
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType, atlas);
        world.addSystem(renderCollect);
        world.setLocalPosition(node, 100, 100);

        world.step(0);
        const base: number = spritePool.get(node);
        const a: number = buffer.transforms[base];
        const b: number = buffer.transforms[base + 1];
        const tx: number = buffer.transforms[base + 2];
        const ty: number = buffer.transforms[base + 3];
        expect(a).toBe(1);
        expect(b).toBe(0);
        expect(tx).toBe(68);
        expect(ty).toBe(68);
    })

    it('center pivot, 90 degree rotation', () => {
        const atlas: SpriteAtlasLookup = createUniformPivotAtlas(16, 64, 64, 0.5, 0.5);
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType, atlas);
        world.addSystem(renderCollect);
        world.setLocalTransform(node, 0,1,100, 100);

        world.step(0);
        const base: number = spritePool.get(node);
        const a: number = buffer.transforms[base];
        const b: number = buffer.transforms[base + 1];
        const tx: number = buffer.transforms[base + 2];
        const ty: number = buffer.transforms[base + 3];
        expect(a).toBe(0);
        expect(b).toBe(1);
        expect(tx).toBe(132);
        expect(ty).toBe(68);
    })

    it('Top-left pivot (0,0) — no correction', () => {
        const atlas: SpriteAtlasLookup = createUniformPivotAtlas(16, 64, 64, 0, 0);
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType, atlas);
        world.addSystem(renderCollect);
        world.setLocalTransform(node, 1,0,100, 100);

        world.step(0);
        const base: number = spritePool.get(node);
        const a: number = buffer.transforms[base];
        const b: number = buffer.transforms[base + 1];
        const tx: number = buffer.transforms[base + 2];
        const ty: number = buffer.transforms[base + 3];
        expect(a).toBe(1);
        expect(b).toBe(0);
        expect(tx).toBe(100);
        expect(ty).toBe(100);
    })

    it('Non-square sprite, center pivot', () => {
        const atlas: SpriteAtlasLookup = createUniformPivotAtlas(16, 100, 60, 0.5, 0.5);
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType, atlas);
        world.addSystem(renderCollect);
        world.setLocalTransform(node, 0,1,200, 150);

        world.step(0);
        const base: number = spritePool.get(node);
        const a: number = buffer.transforms[base];
        const b: number = buffer.transforms[base + 1];
        const tx: number = buffer.transforms[base + 2];
        const ty: number = buffer.transforms[base + 3];
        expect(a).toBe(0);
        expect(b).toBe(1);
        expect(tx).toBe(230);
        expect(ty).toBe(100);
    })

    it('Bottom-center pivot', () => {
        const atlas: SpriteAtlasLookup = createUniformPivotAtlas(16, 64, 64, 0.5, 1);
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType, atlas);
        world.addSystem(renderCollect);
        world.setLocalTransform(node, 1,0,100, 100);

        world.step(0);
        const base: number = spritePool.get(node);
        const a: number = buffer.transforms[base];
        const b: number = buffer.transforms[base + 1];
        const tx: number = buffer.transforms[base + 2];
        const ty: number = buffer.transforms[base + 3];
        expect(a).toBe(1);
        expect(b).toBe(0);
        expect(tx).toBe(68);
        expect(ty).toBe(36);
    })

    it('Multiple types, different pivots', () => {
        const atlas: SpriteAtlasLookup = createUniformPivotAtlas(16, 64, 64, 0.5, 0.5);
        atlas.pivotXs[1] = 0;
        atlas.pivotYs[1] = 0;
        const node2: NodeHandle = world.createNode();
        world.attach(node2, world.root);
        spritePool.add(node2);
        spriteType[spritePool.get(node2)] = 1;

        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType, atlas);
        world.addSystem(renderCollect);
        world.setLocalTransform(node, 1,0,100, 100);
        world.setLocalTransform(node2, 1,0,100, 100);

        world.step(0);
        const base1: number = spritePool.get(node) * 4;
        const a1: number = buffer.transforms[base1];
        const b1: number = buffer.transforms[base1 + 1];
        const tx1: number = buffer.transforms[base1 + 2];
        const ty1: number = buffer.transforms[base1 + 3];
        const base2: number = spritePool.get(node2) * 4;
        const a2: number = buffer.transforms[base2];
        const b2: number = buffer.transforms[base2 + 1];
        const tx2: number = buffer.transforms[base2 + 2];
        const ty2: number = buffer.transforms[base2 + 3];
        expect(a1).toBe(1);
        expect(b1).toBe(0);
        expect(tx1).toBe(68);
        expect(ty1).toBe(68);
        expect(a2).toBe(1);
        expect(b2).toBe(0);
        expect(tx2).toBe(100);
        expect(ty2).toBe(100);
    })
})
