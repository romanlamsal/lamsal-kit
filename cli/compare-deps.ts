import type { RegistryEntry } from "../registry"
import { compareVersions, parseVersion } from "./parse-version"

type DependencyStats = { name: string; nextVersion: string; install: boolean; conflictWith?: string; dev: boolean }

export function compareDeps(
    { dependencies = [], devDependencies = [] }: RegistryEntry,
    {
        dependencies: currentDependencies = {},
        devDependencies: currentDevDependencies = {},
    }: {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
    },
): DependencyStats[] {
    const mergedCurrentDeps = {
        ...currentDevDependencies,
        ...currentDependencies,
    }

    return [...dependencies, ...devDependencies].map((dep, index) => {
        const [name, nextVersion = "latest"] = dep.split("@") as [string, string | undefined]
        const stats: DependencyStats = { name, nextVersion, install: true, dev: index >= dependencies.length }

        const currentVersion = mergedCurrentDeps[name]

        if (!currentVersion) {
            return stats
        }

        const versionComparison = compareVersions(
            parseVersion(currentVersion) ?? {
                major: 0,
                minor: 0,
                patch: 0,
                modifier: "major",
            },
            parseVersion(nextVersion) ?? "latest",
        )

        if (versionComparison === 0) {
            stats.install = false
        } else {
            stats.conflictWith = currentVersion
        }

        return stats
    })
}
