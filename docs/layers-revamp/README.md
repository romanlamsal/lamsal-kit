# Layers revamp

A rewrite of `registry/docs/agents/layers.md` with a different structure. The old document grew
until changing one sentence made an unrelated paragraph stale: rules were restated in several
places, exceptions were carved out at the rule and again at the exception, provenance and
examples sat inside the rules. This folder rebuilds it as several small documents, each with one
job, and no sentence stated twice. The sharable `layers.md` is generated from them; how, is
decided when it is first generated.

## Documents

- `glossary.md`: definitions only. What a term may do is in the rules. Each term uses only terms
  defined above it.
- `general-rules.md`: rules that apply without exception, in glossary vocabulary. No exceptions
  inline.
- `<group>.md`: specialized rules and faults, one file per group. A fault is what happens when
  general rules meet something — a product's hook inside the product's transaction, a caller
  that stops retrying — and how to resolve it. Each entry names the general rules it narrows.
  Groups emerge while the rules are extracted; none is fixed in advance.
- `examples.md`: examples, each with an id. A rule references an example by id and never
  restates it.
- `issues/NN-<slug>.md`: work items. `**Status:**` line; Context and Problem when opened,
  Decision and Consequences when closed, closed with the commit that landed it. The issue files
  are the only bookkeeping; there is no index.

A rule, general or specialized, is one entry with labeled parts: its id and statement, then
*Why*, *Looks like* (the breach as seen in a diff), *Allowed*, *Provenance* (what source it
follows or departs from) and *Examples* (ids). Only the statement is required. Another rule
narrows or references the statement, never the other parts.

## Tiers

The documents depend downward: general rules use the glossary; specialized rules use both;
examples are referenced from both. The cost of a change rises with the tier.

- **Glossary.** Adding a term is cheap: it slots into the dependency order. Changing one —
  rewording, narrowing, dropping — is an issue, and a fresh session works it: it sweeps every
  lower tier for the term and re-decides whatever the change touched, inside that issue.
- **General rules.** A rule's id is stable for life: never renumbered, never reused; a removed
  rule retires its id. Numbers are labels, not positions. Changing a rule's statement is an
  issue that also visits the specialized rules naming it.
- **Specialized rules.** Changeable without touching the tiers above. Where a fault cannot be
  resolved without changing a general rule or a term, the same issue makes that change, upward,
  under the rules of the tier it touches.

## Working here

1. Read `glossary.md` and `general-rules.md` whole before anything else; specialized files for
   the group at hand.
2. Terms are used exactly as the glossary spells them. No synonyms, no second word for the
   same thing. A word with meaning the glossary does not give it appears only if it is common
   language or a source's well-known term. A rule that needs a new word adds it to the glossary,
   as a definition, first.
3. One statement per rule. Another document refers to a rule by id, never by restating it.
4. A sentence that says what a source says, or that this document departs from one, is that
   rule's provenance and sits with the rule, not in the statement.

## Source material

`registry/docs/agents/layers-revised.md`, `layers-revised-examples.md`, `layers-revised-review.md`
and `layers-revised-provenance.md` are the pass-1 translation of the old document: deduplicated,
with ids, but still in the old vocabulary and with general and specialized rules in one file. They
are the source the documents here are extracted from, and they go once extracted. Nothing here
references them otherwise.
