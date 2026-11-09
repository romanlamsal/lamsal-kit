# Reviews, runbook

Two kinds. The regular review is two Fresh drafts over the distilled set; it runs before each
next review is due, over the rules as they then stand. The fat review is six readers; it runs only
when asked. Between reviews, the regression reader (`regression-reader.md`). A change to a prompt
is a change to what reviews measure, so it is noted in the SUMMARY of the review that made it.

`${ROOT}` is the absolute path of this folder. `${NN}` is the review number, two digits.
`${PREV}` is the previous review's number.

## 1. Setup, in the requester's session

1. Tree clean. Note the HEAD sha; the SUMMARY cites it.
2. `mkdir ${ROOT}/reviews/${NN}`.
3. `node ${ROOT}/distill.mjs > ${ROOT}/reviews/${NN}/distilled.md`.
4. The brief. Unchanged in what the product offers and runs on, copy `reviews/${PREV}/brief.md`.
   Otherwise rebuild it from `domain.md`: the product's capabilities and technologies, as a
   customer or an operator sees them, in the business's words; never its systems, their cut, the
   edge cases, the saga or any mechanism.
5. Commit: `docs(layers-revamp): review ${NN} setup`.

## 2. Regular review: Fresh drafts A and B

Two general-purpose subagents, Opus, effort high, launched in one message, `${X}` = `A` and `B`,
`${x}` = `a` and `b`. Each gets only its prompt; no conversation, no other files.

```
You are an architect drafting a fresh repository, draft ${X}, distilled set (property rules), as part of a peer review of an architecture document.

Root: ${ROOT}
Use absolute paths for every read and write. Do not cd.

READ ONLY these files, whole, and nothing else in the repository (no README, no glossary.md, no the-world.md, no property-rules.md, no issues/, no other reviews, no domain.md, no repo search):
- ${ROOT}/reviews/${NN}/distilled.md  (layers.md: glossary, the world's forces, each property with its rule's Scope and Statement; then layers-why.md: each property's and rule's Why and Provenance)
- ${ROOT}/reviews/${NN}/brief.md  (the product brief)

The document draws on Evans (DDD), Cockburn (hexagonal architecture) and Khononov (Learning DDD); bring that background. Use the glossary's terms exactly as it spells them; where you need a name that is not a glossary term, mark it as a code name in backticks.

YOUR TASK: from the brief and the document alone, draft the architecture of the codebase: TypeScript with the technologies the brief names. Decide everything the document leaves to you and decide it concretely; do not hedge between options, pick one and say you picked. Then, separately, report (a) every decision the document left to you (numbered D1, D2 ...: the decision, what you chose, what else would have held every property), and (b) every sentence of the document you had to pick a reading for (numbered S1, S2 ...: quote the sentence, give both readings, say which you took and what changed in your draft because of it).

OUTPUT: write ONE markdown file to
${ROOT}/reviews/${NN}/dist-fresh-${x}.md
with sections in order: `# Fresh repository draft ${X}, distilled set (property rules)`; `## Systems and what each owns` (a table: system, kind, owns, keeps; external systems; shared kernel; code that is no system); `## Ports and adapters` (per system: driving ports, driven ports, adapters, in TypeScript signatures); `## Calls and messages` (every call between systems and every message, who publishes, who subscribes, synchronous or not, and how a refusal comes back); `## Processes` (deployables, entry points, assembly, migrations); `## Directory tree` (a real tree with file names); `## How each property holds` (P1 ... every property: one paragraph, concrete mechanism, or "does not hold" with why); `## Decisions the document left to me` (D1 ...); `## Sentences I had to pick a reading for` (S1 ...).
Write nothing else anywhere. Be concrete; length is not a concern, padding is. When done, reply with your D-list and S-list headings only (one line each).
```

## 3. Fat review: six readers

Only when asked. The two Fresh drafts of section 2, plus four more, all six launched in one
message, same model and effort.

### Implementer, raw set and distilled set

`${SET}` = `raw` or `distilled`. `${FILES}`: for raw, `${ROOT}/glossary.md`,
`${ROOT}/the-world.md` and `${ROOT}/property-rules.md`; for distilled,
`${ROOT}/reviews/${NN}/distilled.md`. `${OUT}`: `raw-implementer.md` or `dist-implementer.md`.

```
You are the IMPLEMENTER reader, ${SET} set, in a peer review of a rule set for structuring TypeScript codebases into systems and layers.

Root: ${ROOT}
Use absolute paths for every read and write. Do not cd.

READ ONLY these files, whole, and nothing else in the repository (no README, no issues/, no reviews/ other than what is listed, no repo search):
- ${FILES}
- ${ROOT}/domain.md  (the fixture: a made-up tea shop, situations only)

How the documents work: the glossary defines terms; the world states forces and properties (heading, Except, Against, Why); the property rules state one rule per property, each with Scope, Statement, Why, Provenance. A rule is its Scope and Statement read as one; where the Scope does not hold the rule says nothing. MUST/MUST NOT: no deviation. SHOULD: default. MAY: a permission where another rule would forbid. Why and Provenance bind nobody. Use terms exactly as the glossary spells them.

YOUR TASK
1. Build the fixture under the rules. For every situation in domain.md (the systems table, each edge case, each step of the checkout saga, the cross-cutting reads) write the code that follows every rule whose Scope holds. Real TypeScript snippets, file paths in a directory tree, not prose claims. Fixture lines that name a mechanism are situations to place, not facts that cannot change; say where you read one as a fact.
2. Where no code can follow every rule whose Scope holds, that is a `cannot-comply` finding: write it as a breach example (format below), naming the rules and showing the code that comes closest.
3. Where a Why argues a harm the Scope and Statement do not refuse, that is a finding: quote both.

EXAMPLE FORMAT (embedded in your output file):
### <rule-id-lowercase>-<ok|breach>-<slug>
```yaml
breaches: [..rule ids..]
satisfies: [..rule ids..]
situation: <fixture situation in a few words>
finding: cannot-comply
```
# <Title>
```ts
// <file path> — <one-line context>
<code>
```
<what makes it a breach, which rules, why>

OUTPUT: write ONE markdown file to
${ROOT}/reviews/${NN}/${OUT}
with these sections in order: `# Implementer review, ${SET} set`; `## Summary` (bullets, one per finding, rule ids, one sentence); `## Findings` (the cannot-comply examples); `## How the fixture is built` (subsections: Systems, catalog, shop, payment, billing, fulfillment, common library, The checkout saga, Cross-cutting reads; code and tree); `## Why without Statement`; `## Notes` (numbered N1, N2 ...: readings you had to pick, fixture sentences you hung on, undefined words).
Write nothing else anywhere. Be concrete and exhaustive; length is not a concern, padding is. When done, reply with your Summary section only.
```

### Fresh repo, raw set, drafts A and B

The prompt of section 2, with these changes: `raw set` for `distilled set`; READ ONLY
`${ROOT}/glossary.md`, `${ROOT}/the-world.md`, `${ROOT}/property-rules.md` and
`${ROOT}/reviews/${NN}/brief.md`, and nothing else (no README, no issues/, no reviews/ other than
the brief, no domain.md, no repo search); output `${ROOT}/reviews/${NN}/raw-fresh-${x}.md`.

## 4. After the readers, in the requester's session

Read the output files whole.

1. `reviews/${NN}/SUMMARY.md`: the counts against the previous review (Fresh D and S counts, and
   for a fat review cannot-comply and Why-without-Statement); the previous checklist's items one
   by one with their state now; what is new; where the drafts differ, and whether each holds
   every property; sentences two or more drafts read the same way; undefined words; candidate
   issues.
2. `reviews/${NN}/checklist.md`: every cooperative finding, one line, id `R${NN}-k`. The
   regression reader marks these after each later step.
3. Fold: what the requester accepts goes into issues, new or open. The SUMMARY says what was
   folded and what was not.
4. Commit: `docs(layers-revamp): reviews/${NN}, <what it measured>`.

## 5. The prompt for a fresh session

> Run review ${NN} per `docs/layers-revamp/reviews/regular-review.md`, regular (or fat).
> Previous review: `reviews/${PREV}`. Setup, then the readers at once, then SUMMARY and
> checklist; stop before folding and show me the SUMMARY.

The session reads the README first (Working here, 1), then this file.
