import { existsSync, readFileSync } from "node:fs"
import process from "node:process"
import { cwdPath } from "./cwd-path"
import { type PackageManager, packageManagers } from "./package-manager"

export function detectPackageManager(): PackageManager | undefined {
    const flatPackageManagers = Object.entries(packageManagers).map(([k, v]) => ({
        ...v,
        name: k as PackageManager,
    }))

    try {
        const { packageManager } = JSON.parse(readFileSync(cwdPath("package.json"), "utf-8"))
        if (packageManager) {
            return packageManager.split("@")[0]
        }
        // biome-ignore lint/suspicious/noEmptyBlockStatements: handled later
    } catch {}

    for (const candidate of flatPackageManagers) {
        if (existsSync(cwdPath(candidate.lockfile))) {
            return candidate.name
        }
    }

    for (const candidate of flatPackageManagers) {
        if (process.argv0 === candidate.execBinary) {
            return candidate.name
        }
    }

    return undefined
}
