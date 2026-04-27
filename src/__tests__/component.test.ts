import {Component} from "../state_tree/Component";
import TreeNode from "../state_tree/Node";

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

        node.addComponent<Health>(health);
        expect(node.getComponent<Health>(Health)).toBe(health);
    })

    it('returns undefined for missing component', () => {
        const node: TreeNode = new TreeNode("node");

        expect(node.getComponent<Health>(Health)).toBeUndefined();
    })

    it('calls on attach when attached', () => {
        const node: TreeNode = new TreeNode("node");
        const health: Health = new Health(10);

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

    it('does not allow duplicate components of the same type', () => {
        const node = new TreeNode("node");

        node.addComponent(new Health(10));

        expect(() => node.addComponent(new Health(20))).toThrow('Component of type Health already exists on this node.');
    })
})
