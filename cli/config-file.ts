import {PackageManager} from "./package-manager";

export const CONFIG_FILENAME = "lamsalcn.json";

export type LamsalcnConfig = {
    packageManager: PackageManager,
    srcDirectory: string
}