import {UpdateContext} from "./World";
import {Component} from "./Component";

export default class TreeNode {
    readonly id: string;
    private _parent: TreeNode | null = null;
    private _children: TreeNode[] = [];
    enabled = true;
    private _components: Component[] = []

    addComponent<T extends Component>(component: T): T {
        const ComponentType = component.constructor as new (...args: any[]) => T;

        if (this.hasComponent(ComponentType)) {
            throw new Error(`Component of type ${ComponentType.name} already exists on this node.`);
        }

        component.node = this;
        this._components.push(component);
        component.onAttach?.();
        return component;
    }

    getComponent<T extends Component>(ComponentType: new (...args: any[]) => T): T | undefined {
        return this._components.find(c => c instanceof ComponentType) as T | undefined;
    }

    hasComponent<T extends Component>(
        ComponentType: new (...args: any[]) => T
    ): boolean {
        return this.getComponent(ComponentType) !== undefined
    }

    get components() {
        return [...this._components]
    }


    get parent() { return this._parent; }
    get children() { return [...this._children]; }

    constructor(id: string) {
        if (typeof id !== "string" || id.length === 0) {
            throw new Error('id must be a non-empty string');
        }

        this.id = id;
    }

    /**
    * @internal
    *
    * This method is a structural mutation and should not be called on the node directly, structural mutations should be done through the world
    */
    setParent(parent: TreeNode | null): void {
        this._parent = parent;
    }

    /**
     * @internal
     *
     * This method is a structural mutation and should not be called on the node directly, structural mutations should be done through the world
     */
    addChild(child: TreeNode): void {
        this._children.push(child);
    }

    /**
     * @internal
     *
     * This method is a structural mutation and should not be called on the node directly, structural mutations should be done through the world
     */
    removeChild(child: TreeNode): void {
        this._children = this._children.filter(c => c !== child)
    }

}
