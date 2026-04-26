import {World} from "../state_tree/World";

describe('word', () => {
    it('creates root', () => {
        let world: World = new World();

        expect(world.root).not.toBeNull();
        expect(world.root.id).not.toBeNull();
    })

    it('creates root with null parent', () => {
        let world: World = new World();

        expect(world.root.parent).toBeNull();
    })
})
