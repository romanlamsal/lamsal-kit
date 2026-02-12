import { z } from "zod"

export const RegistryEntrySchema = z.object({
    name: z.string(),
    entry: z.string(),
    dependencies: z.string().array().optional(),
    devDependencies: z.string().array().optional(),
    copyTo: z.string().optional(),
})

export type RegistryEntry = z.infer<typeof RegistryEntrySchema>

export const registryEntries: RegistryEntry[] = [
    {
        name: "biome-config",
        entry: "/biome.json",
        copyTo: "./biome.json",
    },
    {
        name: "consume-generator",
        entry: "/registry/consume-generator.ts",
    },
    {
        name: "typed-event-emitter",
        entry: "/registry/typed-event-emitter.ts",
        dependencies: ["zod"],
    },
    {
        name: "CLAUDE.md (general)",
        entry: "/registry/CLAUDE-general.md",
        copyTo: "./CLAUDE-general.md",
    },
    {
        name: "CLAUDE.md (webapp)",
        entry: "/registry/CLAUDE-webapp.md",
        copyTo: "./CLAUDE-webapp.md",
    },
    {
        name: "gueterbahnhof build&deploy",
        entry: "/registry/github-actions/pnpm-build-and-deploy.yml",
        copyTo: ".github/workflows/build-and-deploy.yml",
    },
    {
        name: "zod-parse-list",
        entry: "/registry/parse-list.ts",
    },
    {
        name: "code-architecture",
        entry: "/registry/code-architecture.md",
        copyTo: "./docs/code-architecture.md",
    },
]
