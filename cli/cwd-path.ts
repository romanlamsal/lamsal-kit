import {join} from "node:path";
import process from "node:process";

export const cwdPath = (...paths: string[]) => join(process.cwd(), ...paths)
