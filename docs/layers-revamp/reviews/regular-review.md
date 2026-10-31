# Regular review, runbook

The regular review is six readers (README, Testing and Peer review): the Implementer over the
raw set and over the distilled set, and two Fresh repo drafts over each. It runs once per spec,
at the spec's last step, or when asked. The optional readers (Gap, Contradiction, Adversarial,
Red team) are not here; their prompts are in the session that ran review 03 and in
`reviews/03/SUMMARY.md`'s counts. Review 03's prompts are reproduced below; a change to a prompt
is a change to what reviews measure, so it is noted in the SUMMARY of the review that made it.

`${ROOT}` is the absolute path of this folder. `${NN}` is the review number, two digits.
`${PREV}` is the previous review's number.

## 1. Setup, in the requester's session

1. Tree clean. Note the HEAD sha; the SUMMARY cites it.
2. `mkdir ${ROOT}/reviews/${NN}`.
3. `node ${ROOT}/distill.mjs > ${ROOT}/reviews/${NN}/distilled.md`. It throws on a missing
   example; fix the Examples line, not the script.
4. `awk '/^## General rules/{exit} {print}' ${ROOT}/reviews/${NN}/distilled.md >
   ${ROOT}/reviews/${NN}/distilled-world.md`: preamble, glossary, the world.
5. The brief. `git diff <prev review sha> HEAD -- ${ROOT}/domain.md`; unchanged in what it
   offers and runs on, copy `reviews/${PREV}/brief.md`. Otherwise rebuild it from `domain.md`:
   the product's capabilities and technologies, as a customer or an operator sees them, in the
   business's words; never its systems, their cut, the edge cases, the saga or any mechanism.
   `reviews/03/brief.md` is the shape.
6. Every example path the distilled names exists (step 3 checked). Count the ok files for the
   raw Implementer prompt, or drop the count.

## 2. Readers, six subagents at once

General-purpose subagents, Opus, effort high, launched in one message. Each gets only its prompt;
no conversation, no other files. Replace `${ROOT}` and `${NN}` before sending.

### Implementer, raw set

```
You are the IMPLEMENTER reader, raw set, in a peer review of a rule set for structuring TypeScript codebases into systems and layers.

Root: ${ROOT}
Use absolute paths for every read and write. Do not cd.

READ ONLY these files, whole, and nothing else in the repository (no README, no issues/, no choices.md, no reviews/, no other docs, no repo search):
- ${ROOT}/glossary.md
- ${ROOT}/the-world.md
- ${ROOT}/general-rules.md
- ${ROOT}/domain.md  (the fixture: a made-up tea shop, situations only)
- every file in ${ROOT}/examples/  (list the directory, read each file)

How the documents work (all you need to know): the glossary defines terms; the-world.md states forces and properties (heading, Except, Against, Why); general-rules.md states rules, each with Id, Scope, Statement, Relies on, Why, Provenance, Examples. A rule is its Scope and Statement read as one; where the Scope does not hold the rule says nothing; where two Scopes hold the narrower governs; a MAY is a permission where another rule would forbid. MUST/MUST NOT: no deviation. SHOULD: default. Why and Relies on bind nobody. Use terms exactly as the glossary spells them.

YOUR TASK
1. Build the fixture under the rules. For every situation in domain.md (the systems table, each edge case, each step of the checkout saga, the cross-cutting reads) write the code that follows every rule whose Scope holds. Real TypeScript snippets, file paths in a directory tree, not prose claims. Fixture lines that name a mechanism are situations to place, not facts that cannot change; say where you read one as a fact.
2. Where no code can follow every rule whose Scope holds, that is a `cannot-comply` finding: write it as a breach example (format below) with `finding: cannot-comply`, naming the rules and showing the code that comes closest.
3. For situations no existing `*-ok-*` example covers, write a new ok example.
4. Check every existing `*-ok-*` example file against the rules as they now stand: (a) does the code meet every rule listed under `satisfies`; (b) does each listed rule's Scope actually hold for that code; (c) does the code breach a rule it does not list; (d) does it contradict a fixture fact in domain.md. Report each failing file by basename with the rule id and one or two sentences of why.
5. Relies-on findings: for each Relies-on line you touch while building, check it against the Scope and Statement of the rule it names; a line that rule does not guarantee is a finding (quote the line, state what the named rule actually guarantees).

EXAMPLE FORMAT (embedded in your output file, never written to examples/):
### <rule-id-lowercase>-<ok|breach>-<slug>.md
```yaml
breaches: [..rule ids..]
satisfies: [..rule ids..]
situation: <fixture situation in a few words>
finding: cannot-comply   # only on a finding
```
# <Title>
```ts
// <file path> — <one-line context>
<code>
```
<what makes it ok or a breach, which rules, why>

OUTPUT: write ONE markdown file to
${ROOT}/reviews/${NN}/raw-implementer.md
with these sections in order: `# Implementer review, raw set`; `## Summary` (bullets, one per finding, file basename, rule ids, one sentence); `## Findings` (the cannot-comply examples); `## How the fixture is built` (subsections: Systems, catalog, shop, payment, billing, fulfillment, common library, The checkout saga, Cross-cutting reads; code and tree); `## New ok examples`; `## Existing ok examples that do not hold` (three subsections: rule under satisfies the code does not meet; rule under satisfies whose Scope the code does not reach; rule not listed that the code breaches, plus fixture facts broken); `## Relies-on findings`; `## Notes` (numbered N1, N2 ...: readings you had to pick, fixture sentences you hung on, undefined words).
Write nothing else anywhere. Be concrete and exhaustive; length is not a concern, padding is. When done, reply with your Summary section only.
```

### Implementer, distilled set

```
You are the IMPLEMENTER reader, distilled set, in a peer review of a rule set for structuring TypeScript codebases into systems and layers.

Root: ${ROOT}
Use absolute paths for every read and write. Do not cd.

READ ONLY these files, whole, and nothing else in the repository (no README, no issues/, no choices.md, no other reviews, no glossary.md/the-world.md/general-rules.md, no repo search, do NOT list examples/):
- ${ROOT}/reviews/${NN}/distilled.md  (glossary, the world, the rules: Scope, Statement, Examples only)
- ${ROOT}/domain.md  (the fixture: a made-up tea shop, situations only)
- exactly the example files distilled.md names by absolute path under `*Examples:*` (`—` means none). Open each. Every path exists; if one does not, report it under Notes.

How the documents work: the preamble of distilled.md says it. A rule is its Scope and Statement read as one; where the Scope does not hold the rule says nothing; where two Scopes hold the narrower governs; a MAY is a permission where another rule would forbid. Use terms exactly as the glossary spells them.

YOUR TASK
1. Build the fixture under the rules. For every situation in domain.md (the systems table, each edge case, each step of the checkout saga, the cross-cutting reads) write the code that follows every rule whose Scope holds. Real TypeScript snippets, file paths in a directory tree, not prose claims. Fixture lines that name a mechanism are situations to place, not facts that cannot change; say where you read one as a fact.
2. Where no code can follow every rule whose Scope holds, that is a `cannot-comply` finding: write it as a breach example (format below) with `finding: cannot-comply`, naming the rules and showing the code that comes closest.
3. For situations no named ok example covers, write a new ok example.
4. Check every `*-ok-*` example file the distilled names against the rules as they now stand: (a) does the code meet every rule listed under `satisfies`; (b) does each listed rule's Scope actually hold for that code; (c) does the code breach a rule it does not list; (d) does it contradict a fixture fact. Report each failing file by basename with rule id and one or two sentences.
5. Note every rule whose purpose Scope and Statement alone do not tell you (you had to guess what it protects).

EXAMPLE FORMAT (embedded in your output file, never written to examples/):
### <rule-id-lowercase>-<ok|breach>-<slug>.md
```yaml
breaches: [..rule ids..]
satisfies: [..rule ids..]
situation: <fixture situation in a few words>
finding: cannot-comply   # only on a finding
```
# <Title>
```ts
// <file path> — <one-line context>
<code>
```
<what makes it ok or a breach, which rules, why>

OUTPUT: write ONE markdown file to
${ROOT}/reviews/${NN}/dist-implementer.md
with sections in order: `# Implementer review, distilled set`; `## Summary` (bullets, one per finding); `## Findings` (cannot-comply examples); `## How the fixture is built` (subsections: Systems, catalog, shop, payment, billing, fulfillment, common library, The checkout saga, Cross-cutting reads); `## New ok examples`; `## Existing ok examples that do not hold` (three subsections as in task 4 plus fixture facts); `## Rules whose purpose the text does not tell`; `## Notes` (numbered N1, N2 ...: readings picked, fixture sentences hung on, undefined words, missing paths).
Write nothing else anywhere. Be concrete and exhaustive; length is not a concern, padding is. When done, reply with your Summary section only.
```

### Fresh repo, raw set, drafts A and B

Two subagents, same prompt, `${X}` = `A` and `B`, `${x}` = `a` and `b`.

```
You are an architect drafting a fresh repository, draft ${X}, raw set, as part of a peer review of two architecture documents.

Root: ${ROOT}
Use absolute paths for every read and write. Do not cd.

READ ONLY these files, whole, and nothing else in the repository (no README, no rules file, no examples/, no issues/, no choices.md, no reviews/, no domain.md, no repo search):
- ${ROOT}/glossary.md  (definitions)
- ${ROOT}/the-world.md  (forces F-ids and properties P-ids, each with heading, Except, Against, Why)
- ${ROOT}/reviews/${NN}/brief.md  (the product brief)

Both documents draw on Evans (DDD), Cockburn (hexagonal architecture) and Khononov (Learning DDD); bring that background. Use the glossary's terms exactly as it spells them; where you need a name that is not a glossary term, mark it as a code name in backticks.

YOUR TASK: from the brief, the glossary and the world alone, draft the architecture of the codebase: TypeScript on Node with the technologies the brief names. Decide everything the two documents leave to you and decide it concretely; do not hedge between options, pick one and say you picked. Then, separately, report (a) every decision the two documents left to you (numbered D1, D2 ...: the decision, what you chose, what else would have held every property), and (b) every sentence of glossary.md or the-world.md you had to pick a reading for (numbered S1, S2 ...: quote the sentence, give both readings, say which you took and what changed in your draft because of it).

OUTPUT: write ONE markdown file to
${ROOT}/reviews/${NN}/raw-fresh-${x}.md
with sections in order: `# Fresh repository draft ${X}, raw set`; `## Systems and what each owns` (a table: system, kind, owns, keeps; external systems; shared kernel; code that is no system); `## Ports and adapters` (per system: driving ports, driven ports, adapters, in TypeScript signatures); `## Calls and messages` (every call between systems and every message, who publishes, who subscribes, synchronous or not, and how a refusal comes back); `## Processes` (deployables, entry points, assembly, migrations); `## Directory tree` (a real tree with file names); `## How each property holds` (P1 ... every property: one paragraph, concrete mechanism, or "does not hold" with why); `## Decisions the documents left to me` (D1 ...); `## Sentences I had to pick a reading for` (S1 ...).
Write nothing else anywhere. Be concrete; length is not a concern, padding is. When done, reply with your D-list and S-list headings only (one line each).
```

### Fresh repo, distilled set, drafts A and B

```
You are an architect drafting a fresh repository, draft ${X}, distilled set, as part of a peer review of an architecture document.

Root: ${ROOT}
Use absolute paths for every read and write. Do not cd.

READ ONLY these files, whole, and nothing else in the repository (no README, no glossary.md, no the-world.md, no general-rules.md, no examples/, no issues/, no choices.md, no other reviews, no domain.md, no repo search):
- ${ROOT}/reviews/${NN}/distilled-world.md  (preamble, glossary, the world: forces F-ids and properties P-ids with heading, Except, Against)
- ${ROOT}/reviews/${NN}/brief.md  (the product brief)

The document draws on Evans (DDD), Cockburn (hexagonal architecture) and Khononov (Learning DDD); bring that background. Use the glossary's terms exactly as it spells them; where you need a name that is not a glossary term, mark it as a code name in backticks.

YOUR TASK: from the brief and the document alone, draft the architecture of the codebase: TypeScript on Node with the technologies the brief names. Decide everything the document leaves to you and decide it concretely; do not hedge between options, pick one and say you picked. Then, separately, report (a) every decision the document left to you (numbered D1, D2 ...: the decision, what you chose, what else would have held every property), and (b) every sentence of the document you had to pick a reading for (numbered S1, S2 ...: quote the sentence, give both readings, say which you took and what changed in your draft because of it).

OUTPUT: write ONE markdown file to
${ROOT}/reviews/${NN}/dist-fresh-${x}.md
with sections in order: `# Fresh repository draft ${X}, distilled set`; `## Systems and what each owns` (a table: system, kind, owns, keeps; external systems; shared kernel; code that is no system); `## Ports and adapters` (per system: driving ports, driven ports, adapters, in TypeScript signatures); `## Calls and messages` (every call between systems and every message, who publishes, who subscribes, synchronous or not, and how a refusal comes back); `## Processes` (deployables, entry points, assembly, migrations); `## Directory tree` (a real tree with file names); `## How each property holds` (P1 ... every property: one paragraph, concrete mechanism, or "does not hold" with why); `## Decisions the document left to me` (D1 ...); `## Sentences I had to pick a reading for` (S1 ...).
Write nothing else anywhere. Be concrete; length is not a concern, padding is. When done, reply with your D-list and S-list headings only (one line each).
```

## 3. After the readers, in the requester's session

Read the six files whole. Read `choices.md` before accepting anything: a finding that lands on
an entry is none; drafts agreeing where an entry says they may differ is the finding.

1. `reviews/${NN}/SUMMARY.md`. Shape of `reviews/03/SUMMARY.md`: a counts table against the
   previous review (cannot-comply, ok files flagged, Relies-on, Fresh D and S counts); the
   previous checklist's items one by one with their state now; what is new; the Fresh drafts as
   a table (systems, payments, Payload, dunning, stock, PaymentIntent, coordination,
   relationships, processes, stores, dashboard) against `choices.md`; sentences three or more
   drafts read the same way; example regressions; undefined words; candidate issues.
2. `reviews/${NN}/checklist.md`: every cooperative finding, one line, id `R${NN}-k`, grouped
   as review 03's: cannot-comply, Relies-on, ok files by cause, words and readings, Fresh
   sentences, choices. The regression reader marks these after each later step.
3. Fold: what the requester accepts goes into issues, new or open, and into `choices.md`
   (new entries, confirmed open, or closed by a rule that closed them). The SUMMARY says what
   was folded and what was not.
4. Commit: `docs(layers-revamp): reviews/${NN}, <what it measured>`.

## 4. The prompt for a fresh session

> Run review ${NN} per `docs/layers-revamp/reviews/regular-review.md`. Previous review:
> `reviews/${PREV}`. Spec: `specs/<NN>-*.md`, step <k>. Setup, then the six readers at once,
> then SUMMARY and checklist; stop before folding and show me the SUMMARY.

The session reads the README first (Working here, 1), then this file.
