// @ts-check

import { existsSync, mkdirSync, rmSync } from "node:fs"
import { writeFile } from "node:fs/promises"
import process from "node:process"
import { pathToFileURL } from "url"
import { z } from "zod"
import packageJson from "../package.json" with { type: "json" }
import { RegistryEntrySchema, registryEntries } from "../registry/RegistryEntry.ts"

export const RegistrySchema = z.object({
    $schema: z.string(),
    entries: RegistryEntrySchema.array(),
})

/** @typedef {import("zod").input<typeof RegistrySchema>} Registry */

const schemaFileName = `schema.json`

export async function buildAndValidate() {
    for (const registryEntry of registryEntries) {
        if (!existsSync(new URL(".." + registryEntry.entry, import.meta.url))) {
            console.error(`Registry entry ${registryEntry.name} not found at ${registryEntry.entry}`)
            process.exit(1)
        }
    }

    const [username, reponame] = packageJson.repository.split("/")

    /** @satisfies Registry */
    const data = {
        $schema: `https://${username}.github.io/${reponame}/${schemaFileName}`,
        entries: registryEntries.map(entry => ({
            ...entry,
            dependencies: entry.dependencies?.map(dep =>
                !dep.includes("@") && packageJson.devDependencies[dep]
                    ? `${dep}@${packageJson.devDependencies[dep]}`
                    : dep,
            ),
            devDependencies: entry.devDependencies?.map(dep =>
                !dep.includes("@") && packageJson.devDependencies[dep]
                    ? `${dep}@${packageJson.devDependencies[dep]}`
                    : dep,
            ),
        })),
    }

    return RegistrySchema.parse(data)
}

/** @param {string} outputDirectory */
export async function writeFiles(outputDirectory) {
    const outputDirectoryUrl = new URL(outputDirectory.replaceAll("\/*$", "") + "/", pathToFileURL(process.cwd() + "/"))

    rmSync(outputDirectoryUrl, { recursive: true, force: true })
    mkdirSync(outputDirectoryUrl, { recursive: true })

    const registry = await buildAndValidate()

    await Promise.all([
        writeFile(new URL("registry.json", outputDirectoryUrl), JSON.stringify(registry, null, 2)),
        writeFile(new URL(schemaFileName, outputDirectoryUrl), JSON.stringify(z.toJSONSchema(RegistrySchema), null, 2)),
    ])
}

if (process.argv[2] === "--validate") {
    await buildAndValidate().then(() => console.log("Registry validation successful."))
    process.exit(0)
}

const outputDirectoryArg = process.argv[2]
if (outputDirectoryArg) {
    await writeFiles(outputDirectoryArg)
}
