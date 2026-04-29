import {NULL, ROOT_ID} from "../constants";
import {FlatTreeStorage} from "../FlatTreeStorage";

describe('flat storage', () => {
    it(`initializes root alive at id ${ ROOT_ID }`, () => {
        const storage: FlatTreeStorage = new FlatTreeStorage(10);

        expect(storage.alive[ROOT_ID]).toBe(1);
    })

    it(`initializes root parent/children/siblings to ${ NULL }`, () => {
        const storage: FlatTreeStorage = new FlatTreeStorage(10);

        expect(storage.parent[ROOT_ID]).toBe(NULL);
        expect(storage.firstChild[ROOT_ID]).toBe(NULL);
        expect(storage.nextSibling[ROOT_ID]).toBe(NULL);
        expect(storage.prevSibling[ROOT_ID]).toBe(NULL);
    })

    it(`allocate returns id 1, then 2, then 3`, () => {
        const storage: FlatTreeStorage = new FlatTreeStorage(10);
        const node1: { id: number; version: number} = storage.allocate();
        const node2: { id: number; version: number } = storage.allocate();
        const node3: { id: number; version: number } = storage.allocate();

        expect(node1.id).toBe(1);
        expect(node2.id).toBe(2);
        expect(node3.id).toBe(3);
    })

    it('allocation marks node alive', () => {
        const storage: FlatTreeStorage = new FlatTreeStorage(10);
        expect(storage.alive[1]).toBe(0);
        storage.allocate();
        expect(storage.alive[1]).toBe(1);
    })

    it('allocation resets parent/child/sibling pointers', () => {
        // cannot test yet because no way to attachc nodes TODO
        expect(true).toBe(true);
    })

    it("allocation throws when capacity is full", () => {
        const storage: FlatTreeStorage = new FlatTreeStorage(1);
        expect(() => storage.allocate()).toThrow("FlatTreeStorage is full");
    })

    it('free marks node dead', () => {
        const storage: FlatTreeStorage = new FlatTreeStorage(10);
        const node1: { id: number; version: number } = storage.allocate();
        const node2: { id: number; version: number } = storage.allocate();

        storage.free(node1.id);
        expect(storage.alive[node1.id]).toBe(0);
        expect(storage.alive[node2.id]).toBe(1);
    })

    it('free reuses node on next allocation and increments version', () => {
        const storage: FlatTreeStorage = new FlatTreeStorage(10);
        const node1: { id: number; version: number } = storage.allocate();
        storage.free(node1.id);
        const node2: { id: number; version: number } = storage.allocate();

        expect(node1.id).toBe(node2.id);
        expect(node2.version).toBe(node1.version + 1);
    })

    it('rejects stale version', () => {
        const storage: FlatTreeStorage = new FlatTreeStorage(10);
        const node1: { id: number; version: number } = storage.allocate();
        storage.free(node1.id);
        const node2: { id: number; version: number } = storage.allocate();

        expect(() => storage.assertValidRef(node1.id, node1.version)).toThrow("Stale node reference")
    })

    it('cannot free root', () => {
        const storage: FlatTreeStorage = new FlatTreeStorage(10);
        expect(() => storage.free(ROOT_ID)).toThrow("Cannot free root");
    })

    it('cannot free dead node', () => {
        const storage: FlatTreeStorage = new FlatTreeStorage(10);
        const node1: { id: number; version: number } = storage.allocate();
        storage.free(node1.id);

        expect(() => storage.free(node1.id)).toThrow(`Node id ${node1.id} is not alive`);
    })
})
