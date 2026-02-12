import { execSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs"
import { readFile } from "node:fs/promises"
import * as os from "node:os"
import { basename, dirname, join } from "node:path"
import process from "node:process"
import { checkbox, confirm } from "@inquirer/prompts"
import degit from "degit"
import minimist from "minimist"
import { z } from "zod"
import type { RegistryEntry } from "../registry/RegistryEntry"
import { compareDeps } from "./compare-deps"
import { CONFIG_FILENAME, type LamsalcnConfig } from "./config-file"
import { cwdPath } from "./cwd-path"
import { detectPackageManager } from "./detect-package-manager"
import type { PackageManager } from "./package-manager"

const configPath = cwdPath(CONFIG_FILENAME)

const ArgsSchema = z
    .object({
        _: z.string().array().default([]),
        out: z.string().optional(),
        force: z.boolean().optional(),
        verbose: z.boolean().optional(),
    })
    .refine(
        val => !val.out || (val.out && val._.length === 1),
        "Cannot use 'out' without specific registry entry to add.",
    )

const { _: entriesToAdd, force, verbose, out } = ArgsSchema.parse(minimist(process.argv.slice(3)))

async function getRegistry() {
    if (process.env["REGISTRY_JSON"] && !URL.canParse(process.env["REGISTRY_JSON"])) {
        return JSON.parse(readFileSync(process.env["REGISTRY_JSON"], "utf8")) as RegistryEntry[]
    }

    return fetch(process.env["REGISTRY_JSON"] ?? "https://romanlamsal.github.io/lamsal-kit/registry.json")
        .then(res => res.json() as Promise<{ entries: RegistryEntry[] }>)
        .then(res => res.entries)
}

const registry = await getRegistry()
    .then(async res => res.sort((a, b) => a.name.localeCompare(b.name)))
    .catch(err => {
        console.error("Could not fetch registry:", err)
        process.exit(1)
    })

async function getAdded(): Promise<string[]> {
    const registeredSources = registry.map(regEntry => regEntry.name)
    if (entriesToAdd.length) {
        const notFound = entriesToAdd.filter(candidate => !registeredSources.includes(candidate))
        if (notFound.length) {
            console.log(`Unknown option${notFound.length !== 1 ? "s" : ""}: "${notFound.join(", ")}"`)
            process.exit(1)
        }

        return entriesToAdd
    }

    try {
        return checkbox({
            message: "Code to add",
            choices: registeredSources,
        }).catch(e => (e instanceof Error && e.name === "ExitPromptError" ? process.exit(1) : e))
    } catch (err) {
        if (err instanceof Error && err.name === "ExitPromptError") {
            console.log("Aborted.")
        }
        process.exit(1)
    }
}

const added = await getAdded()
console.log("Adding:", added)

const selectedEntries = added.map(name => registry.find(r => r.name === name)!)
const needsSrcDir = !out && selectedEntries.some(e => !e.copyTo)
const hasDeps = selectedEntries.some(e => (e.dependencies?.length ?? 0) > 0 || (e.devDependencies?.length ?? 0) > 0)

let packageManager: PackageManager | undefined
let srcDirectory: string | undefined

if (existsSync(configPath)) {
    const lamsalCnConfig = JSON.parse(readFileSync(configPath, "utf8")) as LamsalcnConfig
    packageManager = lamsalCnConfig.packageManager
    srcDirectory = lamsalCnConfig.srcDirectory
} else {
    packageManager = detectPackageManager()

    if (needsSrcDir) {
        console.error(`At least one selected entry has no default output location. Need to call "init" first.`)
        process.exit(1)
    }

    if (hasDeps && !packageManager) {
        console.error(`Could not detect package manager. Need to call "init" first.`)
        process.exit(1)
    }
}

async function clone(entry: string, cb: (outputLocation: string) => Promise<void>): Promise<void> {
    const { repository } = await import("../package.json")

    const emitter = degit(join(repository, entry), {
        cache: false,
        force,
        verbose,
    })

    const id = randomUUID()
    const degitOutput = join(os.tmpdir(), `lamsal-kit-${id}`)

    try {
        await emitter.clone(degitOutput)

        await cb(degitOutput)
    } finally {
        rmSync(degitOutput, { recursive: true, force: true })
    }
}

async function copySources(added: string[]) {
    const packageJson = await readFile(cwdPath("package.json"), "utf8").then(contents => {
        try {
            return JSON.parse(contents) as {
                dependencies?: Record<string, string>
                devDependencies?: Record<string, string>
            }
        } catch {
            return {}
        }
    })

    const overallDeps = []
    const overallDevDeps = []

    for (const regEntryName of added) {
        const config: RegistryEntry | undefined = registry.find(regEntry => regEntry.name === regEntryName)

        if (!config) {
            console.error(`FATAL: could not find config for source ${regEntryName}. Aborted.`)
            process.exit(1)
        }

        /**
         * DEPENDENCIES
         */
        const comparedDeps = compareDeps(config, packageJson)

        if (comparedDeps.some(d => d.conflictWith)) {
            const conflictsString = comparedDeps
                .filter(d => d.conflictWith)
                .map(({ name, nextVersion, conflictWith }) => `${name}: ${conflictWith} -> ${nextVersion}`)
                .join("\n")

            if (
                !(await confirm({
                    message: `Overwrite the following dependencies?\n${conflictsString}`,
                }).catch(() => process.exit(1)))
            ) {
                continue
            }
        }

        overallDeps.push(...comparedDeps.filter(d => !d.dev && d.install).map(d => d.name + "@" + d.nextVersion))
        overallDevDeps.push(...comparedDeps.filter(d => d.dev && d.install).map(d => d.name + "@" + d.nextVersion))

        const copyTo = out ?? config.copyTo

        /**
         * CLONING SOURCES
         */
        await clone(config.entry, async outputLocation => {
            let outputDir = cwdPath(copyTo ?? srcDirectory!.replace(/\/+$/, "") + "/")

            if (!outputDir.endsWith("/")) {
                outputDir = dirname(outputDir)
            }

            if (!existsSync(outputDir)) {
                mkdirSync(outputDir, { recursive: true })
            }

            let outputPath = join(outputDir, basename(copyTo ?? config.entry))
            if (copyTo?.endsWith("/")) {
                outputPath = join(outputDir, basename(config.entry))
            }
            console.log(`Copying ${regEntryName} to ${outputPath}`)

            // files can be copied as-is to their output directory
            if (statSync(outputLocation).isFile()) {
                execSync(`mv ${outputLocation} ${outputPath}`, { stdio: "inherit" })
                return
            }

            // if output location is already an existing directory, copy only the contents
            const copySource = statSync(outputDir).isDirectory() ? join(outputLocation, "*") : outputLocation

            execSync(`mv ${copySource} ${outputPath}`, { stdio: "inherit" })
            return
        }).then(() => {
            console.log("Done.")
        })
    }

    if (!packageManager) {
        return
    }

    if (overallDeps.length) {
        console.log("Adding deps:", overallDeps.join(","))
        execSync(`${packageManager} add ${overallDeps.join(" ")}`, { cwd: process.cwd(), stdio: "inherit" })
    }

    if (overallDevDeps.length) {
        console.log("Adding devDeps:", overallDeps.join(","))
        execSync(
            `${packageManager} add ${packageManager === "npm" ? "--save-dev" : "-D"} ${overallDevDeps.join(" ")}`,
            { cwd: process.cwd(), stdio: "inherit" },
        )
    }
}

await copySources(added)

process.exit(0)
