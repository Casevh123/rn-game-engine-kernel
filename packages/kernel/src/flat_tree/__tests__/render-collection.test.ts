import {FlatWorld, NodeHandle, System} from "../types";
import {createFlatWorld} from "../FlatWorld";
import {createSpritePool} from "../SpritePool";

describe('render collection tests', () => {
    it('empty scene', () => {
        const world: FlatWorld = createFlatWorld(1024);
        const { pool: spritePool, spriteType } = createSpritePool(world, 1);
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
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType);
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
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType);
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
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType);
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
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType);
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
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType);
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
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType);
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
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType);
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
        const {system: renderCollect, buffer} = world.createRenderCollectionSystem(spritePool, spriteType);
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
