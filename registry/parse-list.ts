import type { z } from "zod"

export const parseList = <T>(schema: z.Schema<T>, list: unknown[]) =>
    list.reduce<T[]>((acc, curr) => {
        const { data } = schema.safeParse(curr)

        if (data) {
            acc.push(data)
        }

        return acc
    }, [] as T[])
