import { existsSync, writeFileSync } from "node:fs"
import * as process from "node:process"
import { input, select } from "@inquirer/prompts"
import { CONFIG_FILENAME, type LamsalcnConfig } from "./config-file"
import { cwdPath } from "./cwd-path"
import { detectPackageManager } from "./detect-package-manager"
import { type PackageManager, packageManagers } from "./package-manager"

const configFilePath = cwdPath(CONFIG_FILENAME)
const configExists = existsSync(configFilePath)

const force = process.argv.includes("--force")
const dryRun = process.argv.includes("--dry")

if (configExists && !force) {
    console.log("Config already exists. Use --force to re-initialize.")
    process.exit(1)
}

if (configExists && force) {
    console.log("Config already exists. Forcing re-initialize.")
}

async function getPackageManager(): Promise<PackageManager> {
    const detected = detectPackageManager()
    if (detected) {
        return detected
    }

    const flatPackageManagers = Object.entries(packageManagers).map(([k, v]) => ({ ...v, name: k as PackageManager }))

    try {
        return await select({
            message: "Select package manager",
            default: "pnpm",
            choices: flatPackageManagers.map(pm => pm.name),
        })
    } catch (e) {
        if (e instanceof Error && e.name === "ExitPromptError") {
            console.log("Aborted.")
            process.exit(1)
        }

        return "npm"
    }
}

const packageManager = await getPackageManager()

let srcDirectory: string
try {
    srcDirectory = await input({
        message: `Add new sources to ${process.cwd()}/`,
    })
} catch (e) {
    if (e instanceof Error && e.name === "ExitPromptError") {
        console.log("Aborted.")
    }
    process.exit(1)
}

const config: LamsalcnConfig = {
    packageManager,
    srcDirectory: srcDirectory.replace(/^\.?\/*/, "./"),
}

const configContent = JSON.stringify(config, null, 2)

console.log("Final config:")
console.log(configContent)

if (dryRun) {
    process.exit(0)
}

writeFileSync(configFilePath, configContent)

console.log("Config created.")

process.exit(0)
