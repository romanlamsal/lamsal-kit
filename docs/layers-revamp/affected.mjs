// @ts-check

// The affected set of a change: what a diff of glossary.md, the-world.md and general-rules.md
// touches below itself. For each changed rule: the Relies-on lines that name it, the examples
// whose front matter names it, the Examples lines that name those files. For each changed
// glossary term: every property and rule whose text uses the word. For each changed property or
// force: a note that no rule names them, so every rule is affected (README, Tiers).
// Usage: node docs/layers-revamp/affected.mjs [base] [head]
//   base: a git ref, default HEAD; head: a git ref, default the working tree.
//   node docs/layers-revamp/affected.mjs ccfa1e9 HEAD   # everything since review 02
// Mechanical only: it finds where a word or an id occurs, not whether the sentence still holds.
// Each hit is read and decided by the session that made the change, or handed to the
// regression reader (reviews/regression-reader.md).

import { execSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const DIR = fileURLToPath(new URL(".", import.meta.url))
const REL = "docs/layers-revamp/"
const DOCS = ["glossary.md", "the-world.md", "general-rules.md"]
const [base = "HEAD", head] = process.argv.slice(2)

/** @param {string} name @param {string | undefined} ref */
const at = (name, ref) =>
    ref === undefined
        ? readFileSync(DIR + name, "utf8")
        : execSync(`git show ${ref}:${REL}${name}`, { cwd: DIR, encoding: "utf8" })

/**
 * Splits a document into blocks keyed by rule id, glossary term, property or force id.
 * @param {string} text
 * @returns {Map<string, string>}
 */
const blocks = text => {
    /** @type {Map<string, string>} */
    const out = new Map()
    let key = ""
    for (const line of text.split("\n")) {
        const rule = /^\*\*([A-Z]{2,4}-\d+)\*\*$/.exec(line)
        const term = /^\*\*([^.*]+)\.\*\* /.exec(line)
        const prop = /^### (P\d+)\. /.exec(line)
        const force = /^- \*\*(F\d+)\. /.exec(line)
        const heading = /^#{1,2} /.test(line)
        const next = rule?.[1] ?? prop?.[1] ?? force?.[1] ?? (term && !rule ? term[1] : undefined)
        if (next !== undefined) {
            key = next
            out.set(key, "")
        } else if (heading) {
            key = ""
        }
        if (key) {
            out.set(key, `${out.get(key)}${line}\n`)
        }
    }
    return out
}

/**
 * What binds of a block: a rule's Scope and Statement, a property's heading, Except and Against,
 * a glossary term or force whole. A change elsewhere in the block is noted, not swept.
 * @param {string} text
 */
const binding = text => text.replace(/\*(Relies on|Why):\*[\s\S]*/, "")

/** @param {string} name */
const changed = name => {
    const before = blocks(at(name, base))
    const after = blocks(at(name, head))
    /** @type {{ added: string[], removed: string[], changed: string[] }} */
    const result = { added: [], removed: [], changed: [] }
    for (const [key, text] of after) {
        const old = before.get(key)
        if (old === undefined) result.added.push(key)
        else if (old !== text) result.changed.push(binding(old) !== binding(text) ? key : `${key} (Why, Relies on, Provenance or Examples only)`)
    }
    for (const key of before.keys()) {
        if (!after.has(key)) result.removed.push(key)
    }
    return result
}

const rules = at("general-rules.md", head)
const world = at("the-world.md", head)
const ruleLines = rules.split("\n")
const worldLines = world.split("\n")

/** The rule or property a line of general-rules.md or the-world.md sits in. @param {string[]} lines @param {number} index */
const owner = (lines, index) => {
    for (let i = index; i >= 0; i--) {
        const m = /^\*\*([A-Z]{2,4}-\d+)\*\*$|^### (P\d+)\. /.exec(lines[i])
        if (m) return m[1] ?? m[2]
    }
    return "(preamble)"
}

/** @param {string} id */
const reliesOn = id =>
    ruleLines
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => new RegExp(`^- ${id}:`).test(line))
        .map(({ line, i }) => `  - ${owner(ruleLines, i)} l.${i + 1}: ${line.slice(2)}`)

const exampleDir = `${DIR}examples/`
const examples = readdirSync(exampleDir)
    .filter(f => f.endsWith(".md"))
    .map(f => {
        const text = readFileSync(exampleDir + f, "utf8")
        const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? ""
        const ids = [...front.matchAll(/\b[A-Z]{2,4}-\d+\b/g)].map(m => m[0])
        return { file: f, ids, finding: /^finding:/m.test(front) }
    })

/** @param {string} id */
const examplesNaming = id => examples.filter(e => e.ids.includes(id)).map(e => `  - examples/${e.file}`)

/** @param {string} file */
const namedBy = file =>
    ruleLines
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => line.startsWith("*Examples:*") && line.includes(file))
        .map(({ i }) => owner(ruleLines, i))

/** Rules and properties whose text uses a term, with line numbers. @param {string} term */
const uses = term => {
    const word = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const re = new RegExp(`\\b${word}s?\\b`, "i")
    /** @type {Map<string, number[]>} */
    const hits = new Map()
    const scan = (/** @type {string[]} */ lines, /** @type {string} */ tag) =>
        lines.forEach((line, i) => {
            if (!re.test(line)) return
            const key = `${tag} ${owner(lines, i)}`
            hits.set(key, [...(hits.get(key) ?? []), i + 1])
        })
    scan(worldLines, "world")
    scan(ruleLines, "rules")
    return [...hits].map(([key, lines]) => `  - ${key} l.${lines.join(", ")}`)
}

const out = [`# Affected set, ${base}..${head ?? "working tree"}`, ""]
const section = (/** @type {string} */ title, /** @type {string[]} */ lines) => {
    if (lines.length) out.push(`## ${title}`, "", ...lines, "")
}

const g = changed("glossary.md")
const w = changed("the-world.md")
const r = changed("general-rules.md")

section("Changed blocks", [
    ...["added", "changed", "removed"].flatMap(kind =>
        [
            ...g[kind].map(k => `- glossary ${kind}: ${k}`),
            ...w[kind].map(k => `- world ${kind}: ${k}`),
            ...r[kind].map(k => `- rule ${kind}: ${k}`),
        ]),
])

for (const term of [...g.added, ...g.changed, ...g.removed]) {
    section(`Term ${term}, used by`, uses(term))
}

if (w.added.length + w.changed.length + w.removed.length) {
    section("World", [
        "- No rule names the property it serves: every rule, general or group, is read against the change (README, Tiers).",
    ])
}

for (const key of [...r.added, ...r.changed, ...r.removed]) {
    const id = key.split(" ")[0]
    const files = examplesNaming(id)
    const named = [...new Set(files.flatMap(f => namedBy(f.trim().slice("- ".length))))].filter(o => o !== id)
    section(`Rule ${key}`, [
        ...(reliesOn(id).length ? ["Relies-on lines naming it:", ...reliesOn(id)] : ["Relies-on lines naming it: none"]),
        ...(files.length ? ["Examples naming it:", ...files] : ["Examples naming it: none"]),
        ...(named.length ? [`Other rules whose Examples line names one of those files: ${named.join(", ")}`] : []),
    ])
}

process.stdout.write(`${out.join("\n")}\n`)
