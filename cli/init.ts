import {input, select} from "@inquirer/prompts";
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import * as process from "node:process";
import {cwdPath} from "./cwd-path";
import {CONFIG_FILENAME, LamsalcnConfig} from "./config-file";
import {PackageManager, packageManagers} from "./package-manager";

const configFilePath = cwdPath(CONFIG_FILENAME);
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
    const flatPackageManagers = Object.entries(packageManagers).map(([k, v]) => ({...v, name: k as PackageManager}))

    try {
        const { packageManager } = JSON.parse(readFileSync(cwdPath("package.json"), "utf-8"));
        if (packageManager) {
            return packageManager.split("@")[0]
        }
    } catch {

    }

    for (const candidate of flatPackageManagers) {
        if (existsSync(cwdPath(candidate.lockfile))) {
            console.log(`Found lockfile for ${candidate.name}.`)
            return candidate.name
        }
    }

    for (const candidate of flatPackageManagers) {
        if (process.argv0 === candidate.execBinary) {
            return candidate.name
        }
    }

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

let srcDirectory: string;
try {
    srcDirectory = await input({
        message: `Add new sources to ${process.cwd()}/`, });
} catch (e) {
    if (e instanceof Error && e.name === "ExitPromptError") {
        console.log("Aborted.")
    }
    process.exit(1)
}

const config: LamsalcnConfig = {
    packageManager,
    srcDirectory: srcDirectory.replace(/^\.?\/*/, "./")
}

const configContent = JSON.stringify(config, null, 2);

console.log("Final config:")
console.log(configContent)

if (dryRun) {
    process.exit(0)
}

writeFileSync(configFilePath, configContent)

console.log("Config created.")

process.exit(0)
