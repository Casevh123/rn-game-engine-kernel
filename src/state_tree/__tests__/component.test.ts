import {Component} from "../Component";
import TreeNode from "../Node";

describe('component', () => {
    class Health extends Component {
        constructor(public hp: number) {
            super()
        }

        damage(amount: number) {
            this.hp -= amount
        }

        onAttach() {
            this.hp = 1000;
        }
    }

    class Magic extends Component {
        constructor(public mana: number) {
            super()
        }
    }

    it('adding a component updates component reference and adds component', () => {
        const node: TreeNode = new TreeNode("node");
        const health: Health = new Health(10);

        node.addComponent<Health>(health);
        expect(health.node).toBe(node);
        expect(node.components).toContain(health);
    })

    it('node can retrieve component by type', () => {
        const node: TreeNode = new TreeNode("node");
        const health: Health = new Health(10);
        const magic: Magic = new Magic(20);

        node.addComponent<Health>(health);
        node.addComponent<Magic>(magic);
        expect(node.getComponent<Health>(Health)).toBe(health);
        expect(node.getComponent<Magic>(Magic)).toBe(magic);
    })

    it('returns undefined for missing component', () => {
        const node: TreeNode = new TreeNode("node");
        const magic: Magic = new Magic(20);

        node.addComponent<Magic>(magic);

        expect(node.getComponent<Health>(Health)).toBeUndefined();
    })

    it('calls on attach when attached and doesnt break if a component doesnt have onattach', () => {
        const node: TreeNode = new TreeNode("node");
        const health: Health = new Health(10);
        const magic: Magic = new Magic(20);

        expect(health.hp).toBe(10);
        node.addComponent<Health>(health);
        expect(health.hp).toBe(1000)
    })

    it('node.components returns a copy not an internal state array', () => {
        const node: TreeNode = new TreeNode("node");
        const health: Health = new Health(10);
        node.addComponent<Health>(health);
        const components: Component[] = node.components;
        expect(components.length).toBe(1);
        components.pop()
        expect(components.length).toBe(0);
        expect(node.components).toContain(health);
    })

    it('addComponent returns the component instance', () => {
        const node = new TreeNode("node");
        const health = new Health(10);

        const returned = node.addComponent(health);
        expect(returned).toBe(health);
    })

    it('does not allow duplicate components of the same type', () => {
        const node = new TreeNode("node");

        node.addComponent(new Health(10));

        expect(() => node.addComponent(new Health(20))).toThrow('Component of type Health already exists on this node.');
    })
})
