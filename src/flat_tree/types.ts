import {FlatWorld} from "./FlatWorld";

export type System = (world: FlatWorld, dt: number) => void;
