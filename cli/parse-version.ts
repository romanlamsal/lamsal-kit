import { z } from "zod"

const VersionSchema = z
    .object({
        modifier: z.enum(["patch", "minor", "major"]),
        major: z.coerce.number(),
        minor: z.coerce.number(),
        patch: z.coerce.number(),
    })
    .or(z.literal("latest"))

export type Version = z.infer<typeof VersionSchema>

export const parseVersion = (version: string) => {
    if (version === "latest") {
        return "latest"
    }

    const [prefix, major = "0", minor = "0", patch = "0"] = version.match(/(\D*)(\d)+\.(\d)+\.(\d)+.*/)?.slice(1) ?? []

    if (prefix === undefined) {
        return
    }

    const modifier =
        {
            "~": "patch",
            "^": "minor",
        }[prefix] ?? "major"

    return VersionSchema.safeParse({
        modifier,
        major,
        minor,
        patch,
    }).data
}

export const compareVersions = (current: Version, next: Version) => {
    if (current === "latest" || next === "latest") {
        if (next !== "latest") {
            return -1
        }

        if (current !== "latest") {
            return 1
        }

        return 0
    }

    const majorDiff = next.major - current.major

    if (majorDiff !== 0 || current.modifier === "major") {
        return majorDiff
    }

    const minorDiff = next.minor - current.minor

    if (minorDiff !== 0 || current.modifier === "minor") {
        return minorDiff
    }

    return next.patch - current.patch
}
