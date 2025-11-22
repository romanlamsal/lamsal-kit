import {checkbox, confirm} from "@inquirer/prompts";
import type {RegistryEntry} from "../registry";
import process from "node:process";
import {existsSync, mkdir, mkdirSync, readFileSync, rmSync} from "node:fs";
import {cwdPath} from "./cwd-path";
import {CONFIG_FILENAME, type LamsalcnConfig} from "./config-file";
import degit from "degit";
import {readFile} from "node:fs/promises";
import {execSync} from "node:child_process";
import {getConflictingDeps} from "./get-conflicting-deps";
import {join} from "node:path";
import { randomUUID } from "node:crypto";
import * as os from "node:os";

const configPath = cwdPath(CONFIG_FILENAME);
if (!existsSync(configPath)) {
    console.error(`Need to call "init" first.`)
    process.exit(1);
}

const force = process.argv.includes("--force")
const verbose = process.argv.includes("--verbose")

const lamsalCnConfig = JSON.parse(readFileSync(configPath, "utf8")) as LamsalcnConfig;

const registry = await fetch("https://raw.githubusercontent.com/romanlamsal/lamsalcn/refs/heads/main/registry.json")
    .then(res => res.json() as Promise<RegistryEntry[]>).catch((err) => {
        console.error("Could not fetch registry:", err)
        process.exit(1);
    })

async function getAdded(): Promise<string[]> {
    const addPos = process.argv.indexOf('add')

    const added = process.argv.slice(addPos + 1, process.argv.length)

    const registeredSources = registry.map(regEntry => regEntry.name);
    if (added.length) {
        const notFound = added.filter(candidate => !registeredSources.includes(candidate))
        if (notFound.length) {
            console.log(`Unknown option${notFound.length !== 1 ? "s" : ""}: "${notFound.join(", ")}"`)
            process.exit(1);
        }

        return added
    }

    try {
        return checkbox({
            message: "Code to add", choices: registeredSources,
        })
    } catch (err) {
        if (err instanceof Error && err.name === "ExitPromptError") {
            console.log("Aborted.")
        }
        process.exit(1)
    }
}

const added = await getAdded();
console.log("Adding:", added)

async function copySources(added: string[]) {
    const { repository } = await import("../package.json");

    const packageJson = await readFile(cwdPath("package.json"), "utf8").then((contents) => {
        try {
            return JSON.parse(contents) as { dependencies?: Record<string, string>, devDependencies?: Record<string, string> };
        } catch {
            return {}
        }
    })

    const overallDeps = []
    const overallDevDeps = []

    for (const regEntryName of added) {
        const config: RegistryEntry | undefined = registry.find(regEntry => regEntry.name === regEntryName);

        if (!config) {
            console.error(`FATAL: could not find config for source ${regEntryName}. Aborted.`)
            process.exit(1);
        }

        const conflictingDeps = getConflictingDeps(config, packageJson, "dependencies") ?? []
        const conflictingDevDeps = getConflictingDeps(config, packageJson, "devDependencies") ?? []

        if (conflictingDeps.length || conflictingDevDeps.length) {
            const conflictsString = [...(conflictingDeps), ...conflictingDevDeps]
                .map(({ name, current, next }) => `${name}: ${current} -> ${next}`).join("\n")
            const confirmed = await confirm({ message: `Overwrite the following dependencies?\n${conflictsString}` })
                .catch(() => process.exit(1))

            if (!confirmed) {
                console.log("Not confirmed. Skipping.")
                continue
            }
        }

        overallDeps.push(...(config?.dependencies ?? []))
        overallDevDeps.push(...(config?.devDependencies ?? []))

        const outputDir = (() => {
            // copyTo is undefined or a directory
            if (!config.copyTo?.match(/.+\.\w+$/)) {
                return config.copyTo ?? lamsalCnConfig.srcDirectory
            }

            const pathParts = config.copyTo!.split("/")
            return pathParts.slice(0, pathParts.length - 1).join("/")
        })()

        if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true })
        }

        const relativeOutputPath = config.entry.replace(/^\/registry\//, `/`);

        const outputPath = join(outputDir, relativeOutputPath);

        console.log(`Copying ${regEntryName} to ${outputPath}.`)

        const emitter = degit(repository + config.entry, {
            cache: false,
            force,
            verbose,
        })

        const id = randomUUID()
        const degitOutput = join(os.tmpdir(), `lamsalcn-${id}`)

        try {
            await emitter.clone(degitOutput)
            execSync(`mv ${degitOutput} ${cwdPath(outputPath)}`, { stdio: "inherit" })
        } finally {
            rmSync(degitOutput, { recursive: true, force: true })
        }

        console.log("Done.")
    }

    const packageManager = lamsalCnConfig.packageManager

    if (overallDeps.length) {
        execSync(`${packageManager} add ${overallDeps.join(" ")}`, { cwd: process.cwd(), stdio: "inherit" })
    }
    if (overallDevDeps.length) {
        execSync(`${packageManager} add ${(packageManager === "npm" ? "--save-dev" : "-D")} ${overallDevDeps.join(" ")}`, {cwd: process.cwd(), stdio: "inherit" })
    }
}

await copySources(added);

process.exit(0);
