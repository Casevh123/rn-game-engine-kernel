import {Component} from "../Component";
import {UpdateContext} from "../types";
import {World} from "../World";
import TreeNode from "../Node";

describe('Counter', () => {
    class Counter extends Component {
        constructor(public value: number) {
            super()
        }

        update(ctx: UpdateContext) {
            this.value += ctx.dt;
        }
    }

    test('Doesnt update if not attached', () => {
        const world: World = new World();
        const node: TreeNode = new TreeNode("node");
        const counter: Counter = new Counter(0);
        node.addComponent<Counter>(counter);

        world.update(16);
        expect(counter.value).toBe(0);
    })

    test('does update if attached', () => {
        const world: World = new World();
        const node: TreeNode = new TreeNode("node");
        const counter: Counter = new Counter(0);
        node.addComponent<Counter>(counter);
        world.attach(world.root, node);

        world.update(16);
            expect(counter.value).toBe(16);
        world.update(16);
        expect(counter.value).toBe(32);
    })
})

describe('Self-destruction', () => {
    class Health extends Component {
        constructor(public hp: number) {
            super();
        }

        damage(amount: number) {
            this.hp -= amount;
        }

        update(ctx: UpdateContext) {
            this.damage(ctx.dt);
            if (this.hp === 0 ) {
                ctx.commands.destroy(this.node);
            }
        }
    }

    test('it destroys node when it reaches 0 health', () => {
        const world: World = new World();
        const node: TreeNode = new TreeNode("node");
        const health: Health = new Health(30);
        node.addComponent<Health>(health);
        world.attach(world.root, node);

        world.update(15);
        expect(world.hasNode('node')).toBe(true);
        world.update(15);
        expect(world.hasNode('node')).toBe(false);
    })
})
