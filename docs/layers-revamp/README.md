# Layers revamp

A rewrite of `registry/docs/agents/layers.md` with a different structure. The old document grew
until changing one sentence made an unrelated paragraph stale: rules were restated in several
places, exceptions were carved out at the rule and again at the exception, provenance and
examples sat inside the rules. This folder rebuilds it as several small documents, each with one
job, and no sentence stated twice. The documents here are the input: what gets checked for gaps,
inconsistencies and contradictions. The sharable `layers.md` is generated from them; how, and
what it keeps, is decided when it is first generated.

## Documents

- `glossary.md`: definitions only. What a term may do is in the rules. Each term uses only terms
  defined above it.
- `general-rules.md`: rules whose scope is any system. Glossary vocabulary.
- `<group>.md`: rules whose scope is one kind of situation — a product, messaging between
  systems. Groups emerge while the rules are written; none is fixed in advance.
- `domain.md`: the fixture. A made-up shop with the situations the rules are tested against.
  Situations only, no rulings.
- `examples/<id>.md`: one example per file, so a reader opens one and not all. Front matter
  names the rules it breaches and the rules it satisfies. A rule references an example by file
  and never restates it.
- `issues/NN-<slug>.md`: work items. `**Status:**` line; Context and Problem when opened,
  Decision and Consequences when closed, closed with the commit that landed it. The issue files
  are the only bookkeeping; there is no index.

## Rule shape

One rule is one entry with labeled parts. Scope and Statement are read as one unit, by people
and by scripts; a Statement is never judged alone.

- **Id.** Stable for life: never renumbered, never reused; a removed rule retires its id.
  Numbers are labels, not positions.
- **Scope.** The situation the rule governs, in prose: "a use case of this system changes data
  another system owns". Where the Scope does not hold, the rule says nothing.
- **Statement.** One ruling, with one modal verb, capitalized: MUST, MUST NOT, SHOULD, SHOULD NOT,
  MAY. No other modal, no "always", "never", "only", "by default". Two rulings are two rules.
- **Why.** The harm the rule prevents and how it comes about, as long as that takes. Contains no
  ruling: no modal verb, no "only" or "never"; a Why that rules is a Statement in hiding. Breach
  examples show the harm happening. Required.
- **Provenance.** Sources outside this repo: what the rule follows, where it departs from them.
  Never this repo's own history; that lives in git and the issues.
- **Examples.** At least one breach and one ok, as `breach examples/<id>.md · ok
  examples/<id>.md`.

### Strength

The modal verb is the rule's strength.

- **MUST**, **MUST NOT**: no deviation. A codebase that cannot comply changes the rule, through
  an issue.
- **SHOULD**, **SHOULD NOT**: the default. A codebase deviates through an ADR that names the rule
  id, the situation, and what protects against the harm in the rule's Why. A deviation that
  recurs reopens the rule.
- **MAY**: a permission. It exists where another rule would otherwise forbid; its Why names that
  rule's id.

### Exceptions

A rule has no exceptions inline. Where a situation needs a different ruling, that is another rule
with a narrower Scope, usually a MAY. Where the Scopes of two rules both hold, the narrower Scope
governs: a MAY against a MUST is not a deviation, it is the more specific ruling. The MAY
announces itself as an exception; the id reference sits in its Why.

### Testing

Examples are how the rules are checked. A rule without a breach and an ok example is unfinished.
A reviewer who finds a problem writes the example that shows it, not prose.

The fixture is `domain.md`: a made-up shop whose systems carry the situations the rules have to
place. It holds situations, never rulings. Testing a draft is an agent running several readers
over the fixture and the rules, each producing example files:

- **Implementer.** Builds the fixture under the rules. Produces the ok examples, and a finding
  wherever a rule cannot be followed. Runs first; the others need its examples.
- **Gap.** Finds a situation in the fixture that no Scope holds for. Produces an example with
  empty front matter.
- **Contradiction.** Finds one situation two rules rule oppositely. Produces an example naming
  both ids; a script flags any example one rule breaches and another satisfies.
- **Adversarial.** Satisfies a Statement while causing the harm in its Why. Produces a breach
  example the Statement alone would call ok. This is the reader that tests Why.

## Tiers

The documents depend downward: general rules use the glossary; group rules use both; examples
are referenced from both. The cost of a change rises with the tier.

- **Glossary.** Adding a term is cheap: it slots into the dependency order. Changing one —
  rewording, narrowing, dropping — is an issue, and a fresh session works it: it sweeps every
  lower tier for the term and re-decides whatever the change touched, inside that issue.
- **General rules.** Changing a rule's Scope or Statement is an issue that also visits the group
  rules whose Why names it. Changing Why, Provenance or Examples is not.
- **Group rules.** Changeable without touching the tiers above. Where a situation cannot be ruled
  without changing a general rule or a term, the same issue makes that change, upward, under the
  rules of the tier it touches.

## Working here

1. Read `glossary.md` and `general-rules.md` whole before anything else; group files for the
   situation at hand. Never the issue files, unless working one.
2. Terms are used exactly as the glossary spells them. No synonyms, no second word for the
   same thing. A word with meaning the glossary does not give it appears only if it is common
   language or a source's well-known term. A rule that needs a new word adds it to the glossary,
   as a definition, first.
3. One ruling per rule. Another document refers to a rule by id, never by restating it.
4. Work in batches, not sentence by sentence: one session drafts a tier whole, one runs the
   readers over it. A draft is done when every rule has its examples, the readers produce no
   new example, and the script finds no contradiction.

## Source material

`registry/docs/agents/layers-revised.md`, `layers-revised-examples.md`, `layers-revised-review.md`
and `layers-revised-provenance.md` are the pass-1 translation of the old document: deduplicated,
with ids, but still in the old vocabulary and with general and specialized rules in one file. They
are the source the documents here are extracted from, and they go once extracted. Nothing here
references them otherwise.
