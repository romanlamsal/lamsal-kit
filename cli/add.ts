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
import type { RegistryEntry } from "../registry"
import { compareDeps } from "./compare-deps"
import { CONFIG_FILENAME, type LamsalcnConfig } from "./config-file"
import { cwdPath } from "./cwd-path"

const configPath = cwdPath(CONFIG_FILENAME)
if (!existsSync(configPath)) {
    console.error(`Need to call "init" first.`)
    process.exit(1)
}

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

const lamsalCnConfig = JSON.parse(readFileSync(configPath, "utf8")) as LamsalcnConfig

async function getRegistry() {
    if (process.env["REGISTRY_JSON"]) {
        return JSON.parse(readFileSync(process.env["REGISTRY_JSON"], "utf8")) as RegistryEntry[]
    }

    return fetch("https://raw.githubusercontent.com/romanlamsal/lamsal-kit/refs/heads/main/registry.json").then(
        res => res.json() as Promise<RegistryEntry[]>,
    )
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
        })
    } catch (err) {
        if (err instanceof Error && err.name === "ExitPromptError") {
            console.log("Aborted.")
        }
        process.exit(1)
    }
}

const added = await getAdded()
console.log("Adding:", added)

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

        await clone(config.entry, async outputLocation => {
            const outputDir = dirname(cwdPath(copyTo ?? lamsalCnConfig.srcDirectory))

            if (!existsSync(outputDir)) {
                mkdirSync(outputDir, { recursive: true })
            }

            const outputPath = join(outputDir, basename(copyTo ?? config.entry))
            console.log(`Copying ${regEntryName} to ${outputPath}`)

            // files can be copied as-is to their output directory
            if (statSync(outputLocation).isFile()) {
                execSync(`mv ${outputLocation} ${outputPath}`, { stdio: "inherit" })
                return
            }

            // if output location is already an existing directory, copy only the contents
            const copySource =
                existsSync(outputPath) && statSync(outputLocation).isDirectory()
                    ? join(outputLocation, "*")
                    : outputLocation

            execSync(`mv ${copySource} ${outputPath}`, { stdio: "inherit" })
            return
        }).then(() => {
            console.log("Done.")
        })
    }

    const packageManager = lamsalCnConfig.packageManager

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
