export const packageManagers = {
    npm: {
        lockfile: "package-lock.json",
        execBinary: "npx",
    },
    pnpm: {
        lockfile: "pnpm-lock.yaml",
        execBinary: "pnpx",
    },
    bun: {
        lockfile: "bun.lock",
        execBinary: "bunx",
    }
}
export type PackageManager = keyof typeof packageManagers;