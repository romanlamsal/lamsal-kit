import { z } from "zod"

export const RegistryEntrySchema = z.object({
    name: z.string(),
    entry: z.string(),
    dependencies: z.string().array().optional(),
    devDependencies: z.string().array().optional(),
    copyTo: z.string().optional(),
})

export type RegistryEntry = z.infer<typeof RegistryEntrySchema>

export type RegistryEntryEmbedding = { name: string; vector: number[] }[]
