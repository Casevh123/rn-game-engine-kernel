import {FlatWorld} from "../FlatWorld";
import {FlatNodeRef} from "../FlatNodeRef";

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
