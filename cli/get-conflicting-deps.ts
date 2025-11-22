import type {RegistryEntry} from "../registry";

export function getConflictingDeps(config: RegistryEntry, packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>
}, key: keyof typeof packageJson) {
    return config[key]?.reduce((acc, curr) => {
        const [name, version = "latest"] = curr.split("@") as [string, string]

        const currentVersion = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies
        }[name]

        if (!currentVersion) {
            return acc
        }

        if (version === "latest") {
            acc.push({name, current: currentVersion, next: version})
            return acc
        }

        // parse semantic versioning
        const currentMajor = currentVersion.split(".")[0]!
        const nextMajor = version.split(".")[0]

        if (currentMajor !== nextMajor) {
            acc.push({name, current: currentVersion, next: version})
        }

        return acc
    }, [] as { name: string, current: string, next: string }[]);
}