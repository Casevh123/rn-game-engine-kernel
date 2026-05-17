import {FlatWorld, NodeHandle} from "../types";
import {createFlatWorld} from "../FlatWorld";
import {createSpritePool, SpritePoolResult} from "../SpritePool";



describe('spritePool', () => {
    it('Remove sprite (swap-and-pop)', () => {
        const world: FlatWorld = createFlatWorld(10);
        const nodeA: NodeHandle = world.createNode();
        const nodeB: NodeHandle = world.createNode();
        const nodeC: NodeHandle = world.createNode();
        const {pool, spriteType}: SpritePoolResult = createSpritePool(world, 5);
        pool.add(nodeA);
        pool.add(nodeB);
        pool.add(nodeC);
        spriteType[pool.get(nodeA)] = 1;
        spriteType[pool.get(nodeB)] = 2;
        spriteType[pool.get(nodeC)] = 3;
        pool.remove(nodeA);

        expect(pool.get(nodeC)).toBe(0);
        expect(spriteType[0]).toBe(3);
    })

    it('Remove last sprite', () => {
        const world: FlatWorld = createFlatWorld(10);
        const nodeA: NodeHandle = world.createNode();
        const nodeB: NodeHandle = world.createNode();
        const nodeC: NodeHandle = world.createNode();
        const {pool, spriteType}: SpritePoolResult = createSpritePool(world, 5);
        pool.add(nodeA);
        pool.add(nodeB);
        pool.add(nodeC);
        spriteType[pool.get(nodeA)] = 1;
        spriteType[pool.get(nodeB)] = 2;
        spriteType[pool.get(nodeC)] = 3;
        pool.remove(nodeC);

        expect(pool.has(nodeC)).toBe(false);
        expect(pool.count).toBe(2);
    })

    it('Integration with world.destroy', () => {
        const world: FlatWorld = createFlatWorld(10);
        const nodeA: NodeHandle = world.createNode();
        const nodeB: NodeHandle = world.createNode();
        const nodeC: NodeHandle = world.createNode();
        const {pool, spriteType}: SpritePoolResult = createSpritePool(world, 5);
        world.registerPool(pool);
        pool.add(nodeA);
        pool.add(nodeB);
        pool.add(nodeC);
        spriteType[pool.get(nodeA)] = 1;
        spriteType[pool.get(nodeB)] = 2;
        spriteType[pool.get(nodeC)] = 3;
        world.destroy(nodeA);

        expect(pool.get(nodeC)).toBe(0);
        expect(spriteType[0]).toBe(3);
        expect(pool.count).toBe(2);
    })

    it('Pool capacity', () => {
        const world: FlatWorld = createFlatWorld(10);
        const nodeA: NodeHandle = world.createNode();
        const nodeB: NodeHandle = world.createNode();
        const {pool, spriteType}: SpritePoolResult = createSpritePool(world, 1);
        pool.add(nodeA);

        expect(() => pool.add(nodeB)).toThrow("Component pool at capacity");
    })
})
