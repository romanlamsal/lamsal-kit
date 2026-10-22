# Layers revamp

A rewrite of `registry/docs/agents/layers.md` with a different structure. The old document grew
until changing one sentence made an unrelated paragraph stale: rules were restated in several
places, exceptions were carved out at the rule and again at the exception, provenance and
examples sat inside the rules. This folder rebuilds it as several small documents, each with one
job, and no sentence stated twice.

## Target shape

An agent implementing something reads the glossary and the general rules, then checks the
specialized rules before inventing anything.

- `glossary.md`: definitions only. What a term may do is in the rules. Each term uses only terms
  defined above it.
- `general-rules.md`: rules that apply without exception, in glossary vocabulary, one statement
  per rule, with stable ids. No exceptions inline, no examples, no sources.
- `<group>.md`: specialized rules and faults, one file per group. A fault is what happens when
  two general rules meet something — a product's hook inside the product's transaction, a caller
  that stops retrying — and how to resolve it. Each entry names the general rules it narrows.
- `issues/`: work items. One file per item: status, problem, resolution, done when.

Examples, the review checklist and provenance stay out of the rule documents; where they live is
decided when the rules are settled.

## Status

- Glossary settled from `registry/docs/agents/layers-revised.md` Terms (`ebea2ef`).
- General rules: not started. The rules in `layers-revised.md` still use the old vocabulary
  (root, entry, build function, controller, shared kernel, "other system"); the first step is a
  sweep to glossary terms, then the split into general and specialized.
- `layers-revised.md`, `layers-revised-examples.md`, `layers-revised-review.md` and
  `layers-revised-provenance.md` in `registry/docs/agents/` are the pass-1 translation of the
  old document and the source the files here are built from. They go once this folder holds
  everything.

## Working here

1. Terms first. A rule that needs a word the glossary lacks gets the word added there, as a
   definition, before the rule is written.
2. One statement per rule. Another document refers to a rule by id, never by restating it.
3. A sentence that says what a source says, or that this document departs from one, is
   provenance, not a rule. It goes to the provenance document.
4. Record a decision that changes a term or a rule as an issue in `issues/`, closed with the
   commit that landed it.
