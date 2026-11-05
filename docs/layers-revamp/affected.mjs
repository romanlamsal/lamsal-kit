// @ts-check

// The affected set of a change: what a diff of glossary.md, the-world.md and property-rules.md
// touches, read as distill-properties.mjs distills them: the glossary and the world whole,
// property-rules.md without Absorbs, Drops, Glossary notes, Terms used and the Appendix.
// - Changed rule fields, per rule of property-rules.md (P-ids, the sections Assumptions,
//   Conventions and the preamble), distilled fields only; changes to undistilled fields are noted
//   apart, as binding nobody.
// - Changed glossary entries, a bulleted term (`- **Service.**`, `- A *driving port*`) its own
//   entry, a heading's prose (`## System`) the heading's entry; new and removed entries, and
//   italic terms gone from or new to the glossary.
// - Changed blocks of the-world.md: forces, properties by field, sections.
// - For each changed glossary term: what uses it at head, in property-rules (uses in Heading, Scope
//   or Statement apart from Why/Provenance only), the-world (Heading, Except, Against or a force
//   marked *) and other glossary entries. A short form counts (`the upstream`, ALIASES).
// - The examples of the last review (`### p7-breach-….md` headings in reviews/NN/dist-*.md) whose
//   rule changed in Heading, Scope or Statement, or uses a changed term there.
// Text is compared whitespace-normalized: a rewrap is no change. A term matches case-insensitively,
// at word boundaries, singular or plural, across line breaks. A match inside a longer glossary term
// counts for the shorter only where the longer is a kind of it (`driving port` is a port, `open
// host service` is no service); `code repository` is no repository.
// Usage: node docs/layers-revamp/affected.mjs [base] [head]
//   base: a git ref, default HEAD; head: a git ref, default the working tree.
//   node docs/layers-revamp/affected.mjs 1892b7e 8ab0943
// Mechanical only: it finds where a field changed or a word occurs, not whether the meaning changed
// or the sentence still holds. Each hit is read and decided by the session that made the change, or
// handed to the regression reader (reviews/regression-reader.md).

import { execSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const DIR = fileURLToPath(new URL(".", import.meta.url))
const REL = "docs/layers-revamp/"
const [base = "HEAD", head] = process.argv.slice(2)

/** Fields distill-properties.mjs drops. */
const DROPPED = ["Absorbs", "Drops", "Glossary notes", "Terms used"]
/** Fields that bind, per document; every other distilled field is reasoning. */
const BINDING = {
    rules: ["Heading", "Scope", "Statement"],
    world: ["Heading", "Except", "Against"],
}
/** Longer glossary terms that end in a shorter one but are not a kind of it. */
const NOT_A_KIND = ["open host service", "business domain"]
/** Phrases that are no use of the glossary term inside them. */
const SHADOWS = ["code repository"]
/** Short forms the documents use for a glossary term. */
const ALIASES = new Map([
    ["Upstream system", ["upstream"]],
    ["Downstream system", ["downstream"]],
])

/** A document at a ref, empty where the ref has none. @param {string} name @param {string | undefined} ref */
const at = (name, ref) => {
    try {
        return ref === undefined
            ? readFileSync(DIR + name, "utf8")
            : execSync(`git show ${ref}:${REL}${name}`, { cwd: DIR, encoding: "utf8", stdio: "pipe" })
    } catch {
        process.stderr.write(`${name}: none at ${ref ?? "working tree"}, read as empty\n`)
        return ""
    }
}

/** @param {string} text */
const norm = text => text.replace(/\s+/g, " ").trim()

/**
 * A field of a block: its text, whether the distilled output carries it, whether it binds.
 * @typedef {{ name: string, text: string, kept: boolean, binding: boolean }} Field
 */
/**
 * A block of a rules document: a rule or property (`P1`), a force (`F1`) or a section (`Assumptions`).
 * @typedef {{ key: string, kind: "rule" | "force" | "section", fields: Field[] }} Block
 */

/**
 * Splits property-rules.md or the-world.md into blocks and fields, keeping what distill keeps.
 * @param {string} text
 * @param {"rules" | "world"} doc
 * @returns {Map<string, Block>}
 */
const parseRules = (text, doc) => {
    /** @type {Map<string, Block>} */
    const out = new Map()
    let appendix = false
    let afterBlank = false
    /** @param {Block} b */
    const open = b => {
        out.set(b.key, b)
        return b
    }
    /** @param {Block} b @param {string} name @param {boolean} kept */
    const addField = (b, name, kept) => {
        /** @type {Field} */
        const f = { name, text: "", kept, binding: kept && (b.kind === "force" || BINDING[doc].includes(name)) }
        b.fields.push(f)
        return f
    }
    let section = open({ key: "(preamble)", kind: "section", fields: [] })
    let block = section
    let field = addField(section, "text", true)
    for (const line of text.split("\n")) {
        const h2 = /^## (.+)$/.exec(line)
        const h3 = /^### (P\d+)\. (.+)$/.exec(line)
        const force = /^- \*\*(F\d+)\. /.exec(line)
        const fieldStart = /^\*([A-Za-z ]+):\*/.exec(line)
        if (h2 && !appendix) {
            appendix = doc === "rules" && /^Appendix/.test(h2[1] ?? "")
            section = open({ key: h2[1] ?? "", kind: "section", fields: [] })
            block = section
            field = addField(section, "text", !appendix)
            continue
        }
        if (appendix) {
            field.text += `${line}\n`
            continue
        }
        if (h3) {
            block = open({ key: h3[1] ?? "", kind: "rule", fields: [] })
            field = addField(block, "Heading", true)
            field.text = h3[2] ?? ""
            afterBlank = false
            continue
        }
        if (force) {
            block = open({ key: force[1] ?? "", kind: "force", fields: [] })
            field = addField(block, "text", true)
        } else if (fieldStart && block.kind === "rule") {
            const name = fieldStart[1] ?? ""
            field = addField(block, name, !(doc === "rules" && DROPPED.includes(name)))
        } else if (/^\s*$/.test(line)) {
            afterBlank = true
            if (block.kind === "force") {
                block = section
                field = section.fields[0] ?? field
            }
            continue
        } else if (afterBlank && !field.kept) {
            // distill-properties.mjs resumes keeping at a blank line inside a dropped field
            field = addField(block, `${field.name} (after a blank line, distilled)`, true)
        }
        afterBlank = false
        field.text += `${line}\n`
    }
    return out
}

/**
 * A glossary entry: a bold term, a bulleted term, a heading's prose, or a paragraph after an
 * entry's list. `term` is what the entry defines, none for a paragraph after a list.
 * @typedef {{ key: string, term: string | undefined, text: string }} Entry
 */

/** @param {string} t */
const capital = t => t.charAt(0).toUpperCase() + t.slice(1)

/**
 * Splits glossary.md into entries.
 * @param {string} text
 * @returns {Map<string, Entry>}
 */
const parseGlossary = text => {
    /** @type {Map<string, Entry>} */
    const out = new Map()
    /** @param {string} key @param {string | undefined} term */
    const open = (key, term) => {
        const k = out.has(key) ? `${key} (${out.size})` : key
        /** @type {Entry} */
        const e = { key: k, term, text: "" }
        out.set(k, e)
        return e
    }
    /** @type {Entry | undefined} */
    let parent = open("(preamble)", undefined)
    /** @type {Entry | undefined} */
    let cur = parent
    let heading = ""
    let inList = false
    for (const line of text.split("\n")) {
        const h2 = /^## (.+)$/.exec(line)
        const term = /^\*\*([^*]+)\.\*\*/.exec(line)
        const bold = /^- \*\*([^*]+)\.\*\*/.exec(line)
        const italic = /^- (?:An? |The )?\*([^*]+)\*/.exec(line)
        if (h2) {
            heading = h2[1] ?? ""
            cur = undefined
            parent = undefined
            inList = false
            continue
        }
        if (/^\s*$/.test(line)) {
            cur = undefined
            continue
        }
        if (term) {
            parent = open(term[1] ?? "", term[1])
            cur = parent
            inList = false
        } else if (bold || italic) {
            const t = capital((bold ?? italic)?.[1] ?? "")
            cur = open(t, t)
            inList = true
        } else if (line.startsWith("- ")) {
            cur = parent ?? open(heading, heading)
            inList = true
        } else if (cur === undefined) {
            if (parent === undefined) {
                parent = open(heading, heading)
                cur = parent
            } else if (inList) {
                cur = open(`${parent.key} (after its list)`, undefined)
            } else {
                cur = parent
            }
        }
        cur.text += `${line}\n`
    }
    return out
}

/** Italic terms of the glossary, with the entries that hold them. @param {Map<string, Entry>} entries */
const italics = entries => {
    /** @type {Map<string, string[]>} */
    const out = new Map()
    for (const e of entries.values()) {
        for (const m of e.text.matchAll(/(?<!\*)\*([^*\n]+)\*(?!\*)/g)) {
            const t = (m[1] ?? "").toLowerCase()
            out.set(t, [...(out.get(t) ?? []), e.key])
        }
    }
    return out
}

/** A word pattern for a term, its last word singular or plural. @param {string} term */
const pattern = term => {
    const words = term.toLowerCase().split(/\s+/)
    const esc = (/** @type {string} */ w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const last = words.pop() ?? ""
    const plural = /[^aeiou]y$/.test(last)
        ? `${esc(last.slice(0, -1))}(?:y|ies)`
        : /[^su]s$/.test(last)
          ? `${esc(last.slice(0, -1))}s?`
          : /(?:s|x|ch|sh)$/.test(last)
            ? `${esc(last)}(?:es)?`
            : `${esc(last)}s?`
    return new RegExp(`\\b${[...words.map(esc), plural].join("\\s+")}\\b`, "gi")
}

/** @param {string} term */
const lastWord = term => (term.toLowerCase().split(/\s+/).pop() ?? "").replace(/s$/, "")

/**
 * Whether text uses a term, a match inside a longer term or shadow phrase not counted unless the
 * longer term is a kind of it.
 * @param {string} text
 * @param {string} term
 * @param {string[]} vocabulary every glossary term
 */
const usesTerm = (text, term, vocabulary) => {
    const own = [term, ...(ALIASES.get(term) ?? [])]
    /** @type {{ start: number, end: number }[]} */
    const longer = []
    for (const other of [...vocabulary, ...SHADOWS]) {
        if (own.some(o => o.toLowerCase() === other.toLowerCase())) {
            continue
        }
        const kind =
            !SHADOWS.includes(other) && !NOT_A_KIND.includes(other.toLowerCase()) && lastWord(other) === lastWord(term)
        if (kind) {
            continue
        }
        for (const m of text.matchAll(pattern(other))) {
            longer.push({ start: m.index, end: m.index + m[0].length })
        }
    }
    return own.some(o =>
        [...text.matchAll(pattern(o))].some(m => {
            const start = m.index
            const end = start + m[0].length
            return !longer.some(l => l.start <= start && l.end >= end && l.end - l.start > end - start)
        }),
    )
}

/** @template T @param {Map<string, T>} before @param {Map<string, T>} after @param {(a: T, b: T) => boolean} same */
const compare = (before, after, same) => ({
    added: [...after.keys()].filter(k => !before.has(k)),
    removed: [...before.keys()].filter(k => !after.has(k)),
    changed: [...after.keys()].filter(k => {
        const old = before.get(k)
        const now = after.get(k)
        return old !== undefined && now !== undefined && !same(old, now)
    }),
})

/** Field names whose normalized text differs, by distilled or not. @param {Block} old @param {Block} now */
const fieldDiff = (old, now) => {
    const names = [...new Set([...old.fields, ...now.fields].map(f => f.name))]
    /** @param {Block} b @param {string} n */
    const text = (b, n) =>
        norm(
            b.fields
                .filter(f => f.name === n)
                .map(f => f.text)
                .join("\n"),
        )
    /** @param {Block} b @param {string} n */
    const kept = (b, n) => b.fields.some(f => f.name === n && f.kept)
    const differ = names.filter(n => text(old, n) !== text(now, n))
    return {
        kept: differ.filter(n => kept(old, n) || kept(now, n)),
        dropped: differ.filter(n => !kept(old, n) && !kept(now, n)),
    }
}

/** @param {string} key */
const ruleOrder = key => {
    const m = /^[PF](\d+)$/.exec(key)
    return m ? Number(m[1]) : -1
}

const rulesBefore = parseRules(at("property-rules.md", base), "rules")
const rulesAfter = parseRules(at("property-rules.md", head), "rules")
const worldBefore = parseRules(at("the-world.md", base), "world")
const worldAfter = parseRules(at("the-world.md", head), "world")
const glossBefore = parseGlossary(at("glossary.md", base))
const glossAfter = parseGlossary(at("glossary.md", head))

const out = [
    `# Affected set, ${base}..${head ?? "working tree"}`,
    "",
    "Mechanical: `affected.mjs` over glossary.md, the-world.md and property-rules.md as distilled.",
    "Whitespace-normalized; whether a meaning changed is not judged.",
    "",
]
/** A section, its note only where it lists something. @param {string} title @param {string[]} lines @param {string[]} [note] */
const section = (title, lines, note = []) => {
    const body = lines.length ? [...note, ...(note.length ? [""] : []), ...lines] : ["- none"]
    while (body.at(-1) === "") {
        body.pop()
    }
    out.push(`## ${title}`, "", ...body, "")
}

/**
 * Changed blocks of a rules document, per field.
 * @param {Map<string, Block>} before
 * @param {Map<string, Block>} after
 */
const blockChanges = (before, after) => {
    const raw = compare(before, after, (a, b) => JSON.stringify(a) === JSON.stringify(b))
    /** @type {string[]} */
    const kept = []
    /** @type {string[]} */
    const dropped = []
    /** @type {string[]} */
    const quiet = []
    /** Binding fields changed, by block; a new or removed block whole. @type {Map<string, string[]>} */
    const statement = new Map()
    for (const key of raw.changed) {
        const old = before.get(key)
        const now = after.get(key)
        if (!old || !now) {
            continue
        }
        const d = fieldDiff(old, now)
        const mark = d.kept.map(n => {
            const f = [...old.fields, ...now.fields].find(x => x.name === n)
            if (f?.binding) {
                statement.set(key, [...(statement.get(key) ?? []), n])
            }
            const name = n === "text" ? "whole" : n
            return f?.binding ? `${name}*` : name
        })
        if (d.kept.length) {
            kept.push(`- ${key}: ${mark.join(", ")}`)
        }
        if (d.dropped.length) {
            dropped.push(`- ${key}: ${d.dropped.map(n => (n === "text" ? "whole" : n)).join(", ")}`)
        }
        if (!d.kept.length && now.fields.some(f => f.kept)) {
            quiet.push(key)
        }
    }
    for (const key of [...raw.added, ...raw.removed]) {
        statement.set(key, ["whole"])
    }
    return { raw, kept, dropped, quiet, statement }
}

const r = blockChanges(rulesBefore, rulesAfter)
section(
    "Changed rule fields, property-rules.md",
    [
        ...r.raw.added.map(k => `- ${k}: new`),
        ...r.raw.removed.map(k => `- ${k}: removed`),
        ...r.kept,
        ...(r.quiet.length ? [`- No distilled field changed: ${r.quiet.join(", ")}`] : []),
    ],
    ["`*` marks a binding field (Heading, Scope, Statement); a section is listed whole."],
)
if (r.dropped.length) {
    section("Changed undistilled fields, property-rules.md (bind nobody)", r.dropped)
}

const w = blockChanges(worldBefore, worldAfter)
section(
    "Changed blocks, the-world.md",
    [...w.raw.added.map(k => `- ${k}: new`), ...w.raw.removed.map(k => `- ${k}: removed`), ...w.kept],
    [
        "`*` marks Heading, Except, Against or a force. No rule names the property it serves: every rule",
        "is read against the change (README, Tiers).",
    ],
)

const g = compare(glossBefore, glossAfter, (a, b) => norm(a.text) === norm(b.text))
const italicBefore = italics(glossBefore)
const italicAfter = italics(glossAfter)
const italicGone = [...italicBefore.keys()].filter(t => !italicAfter.has(t) && !glossAfter.has(capital(t)))
const italicNew = [...italicAfter.keys()].filter(t => !italicBefore.has(t) && !glossBefore.has(capital(t)))
/** @param {Map<string, Entry>} entries @param {string} key */
const termOf = (entries, key) => entries.get(key)?.term
section("Changed glossary entries", [
    ...g.changed.map(k => (termOf(glossAfter, k) ? `- ${k}` : `- ${k}: defines no term; read with the entry above it`)),
    ...g.added.map(k => `- ${k}: new`),
    ...g.removed.map(k => `- ${k}: removed`),
    ...italicGone.map(t => `- *${t}*: italic term gone (was in ${(italicBefore.get(t) ?? []).join(", ")})`),
    ...italicNew.map(t => `- *${t}*: italic term new (in ${(italicAfter.get(t) ?? []).join(", ")})`),
])

const vocabulary = [...glossAfter.values(), ...glossBefore.values()]
    .map(e => e.term)
    .filter(/** @returns {t is string} */ t => t !== undefined)
const rulesHead = [...rulesAfter.values()]
const ruleIds = rulesHead.filter(b => b.kind === "rule").map(b => b.key)

/** @param {Block} b @param {string} term */
const usingFields = (b, term) => b.fields.filter(f => f.kept && usesTerm(f.text, term, vocabulary))

/** @param {string} term */
const uses = term => {
    /** @type {string[]} */
    const binding = []
    /** @type {string[]} */
    const reasoning = []
    /** @type {string[]} */
    const sections = []
    for (const b of rulesHead) {
        const fields = usingFields(b, term)
        if (!fields.length) {
            continue
        }
        const detail = `${b.key} (${fields.map(f => f.name).join(", ")})`
        if (b.kind === "section") {
            sections.push(b.key)
        } else if (fields.some(f => f.binding)) {
            binding.push(detail)
        } else {
            reasoning.push(detail)
        }
    }
    const world = [...worldAfter.values()]
        .map(b => ({ b, fields: usingFields(b, term) }))
        .filter(x => x.fields.length)
        .map(({ b, fields }) =>
            b.kind === "rule"
                ? `${b.key}${fields.some(f => f.binding) ? "*" : ""} (${fields.map(f => f.name).join(", ")})`
                : `${b.key}${fields.some(f => f.binding) ? "*" : ""}`,
        )
    const gloss = [...glossAfter.values()]
        .filter(e => e.term?.toLowerCase() !== term.toLowerCase())
        .filter(e => usesTerm(e.text.replace(/^(?:- )?\*\*[^*]+\.\*\*/, ""), term, vocabulary))
        .map(e => e.key)
    /** @param {string} label @param {string[]} list */
    const line = (label, list) => (list.length ? [`- ${label}: ${list.join(", ")}`] : [])
    const all = ruleIds.every(id => [...binding, ...reasoning].some(x => x.startsWith(`${id} `)))
    const lines = [
        ...(all
            ? [`- every rule; Why/Provenance only: ${reasoning.map(x => x.split(" ")[0]).join(", ") || "none"}`]
            : [...line("Scope/Statement", binding), ...line("Why/Provenance only", reasoning)]),
        ...line("property-rules sections", sections),
        ...line("the-world", world),
        ...line("glossary", gloss),
    ]
    return { lines: lines.length ? lines : ["- no use"], binding: binding.map(x => x.split(" ")[0] ?? x) }
}

/** Rules whose binding fields use a changed term, by term. @type {Map<string, string[]>} */
const bindingUses = new Map()
const searched = [
    ...[...g.changed, ...g.added].map(k => termOf(glossAfter, k)),
    ...g.removed.map(k => termOf(glossBefore, k)),
    ...italicGone,
    ...italicNew,
].filter(/** @returns {t is string} */ t => t !== undefined)
section(
    "Uses of changed terms, head",
    searched.flatMap(term => {
        const u = uses(term)
        bindingUses.set(term, u.binding)
        return [`### ${term}`, "", ...u.lines, ""]
    }),
    ["Scope/Statement: a use in Heading, Scope or Statement; the-world `*`: in Heading, Except, Against or a force."],
)

const reviewsDir = `${DIR}reviews/`
const lastReview = readdirSync(reviewsDir)
    .filter(d => /^\d+$/.test(d))
    .filter(d => readdirSync(`${reviewsDir}${d}/`).some(f => /^dist-.*\.md$/.test(f)))
    .sort((a, b) => Number(a) - Number(b))
    .pop()
if (lastReview) {
    const dir = `${reviewsDir}${lastReview}/`
    /** @type {Map<string, string[]>} */
    const reasons = new Map()
    for (const [id, fields] of r.statement) {
        reasons.set(id, [`${fields.join(", ")} changed`])
    }
    for (const [term, ids] of bindingUses) {
        for (const id of ids) {
            reasons.set(id, [...(reasons.get(id) ?? []), term])
        }
    }
    const examples = readdirSync(dir)
        .filter(f => /^dist-.*\.md$/.test(f))
        .flatMap(f =>
            [...readFileSync(dir + f, "utf8").matchAll(/^### (p(\d+)-[^\s]+\.md)$/gm)].map(m => ({
                file: f,
                example: m[1] ?? "",
                id: `P${m[2]}`,
            })),
        )
    const lines = [...reasons]
        .sort(([a], [b]) => ruleOrder(a) - ruleOrder(b))
        .flatMap(([id, why]) => {
            const files = examples.filter(e => e.id === id).map(e => `  - ${e.example} (${e.file})`)
            return files.length ? [`- ${id}: ${why.join(", ")}`, ...files] : []
        })
    section(`Examples of review ${lastReview} hanging on the change`, lines, [
        "By the rule id in the file name: its rule changed in Heading, Scope or Statement, or uses a",
        "changed term there (terms listed).",
    ])
}

process.stdout.write(`${out.join("\n").trimEnd()}\n`)
