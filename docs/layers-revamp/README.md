# Layers revamp

A rewrite of `registry/docs/agents/layers.md` with a different structure. The old document grew
until changing one sentence made an unrelated paragraph stale: rules were restated in several
places, exceptions were carved out at the rule and again at the exception, provenance and
examples sat inside the rules. This folder rebuilds it as several small documents, each with one
job, and no sentence stated twice. The documents here are the input: what gets checked for gaps,
inconsistencies and contradictions. The sharable `layers.md` is generated from them; how, and
what it keeps, is decided when it is first generated.

## Documents

- `glossary.md`: definitions only, read as a whole. What a term may do is in the rules.
- `general-rules.md`: rules whose scope is any system. Glossary vocabulary.
- `<group>.md`: rules whose scope is one kind of situation — an external system, messaging between
  systems. Groups emerge while the rules are written; none is fixed in advance.
- `domain.md`: the fixture. A made-up shop with the situations the rules are tested against.
  Situations only, no rulings.
- `examples/<id>.md`: one example per file, so a reader opens one and not all. File name
  `<rule>-<ok|breach>-<slug>.md`. Front matter: `breaches` and `satisfies`, the rule ids;
  `situation`, the fixture situation in a few words; `finding`, present on a reader's finding
  only: `cannot-comply`, `gap`, `contradiction`, `adversarial`. Then a title, a code snippet, and
  what makes it a breach or ok. A rule references an example by file and never restates it.
- `issues/NN-<slug>.md`: work items. `**Status:**` line; Context and Problem when opened,
  Decision and Consequences when closed, closed with the commit that landed it. The issue files
  are the only record of decisions; there is no index.
- `specs/NN-<slug>.md`: an order to work issues in, as numbered steps. A session told "the next
  in the spec" works the first unchecked step and checks it in the commit that lands it.

## Rule shape

One rule is one entry with labeled parts. Scope and Statement are the rule, read as one unit, by
people and by scripts; a Statement is never judged alone. The other parts serve them.

- **Id.** Stable for life: never renumbered, never reused; a removed rule retires its id.
  Numbers are labels, not positions.
- **Scope.** The situation the rule governs, in prose: "a use case of this system changes data
  another system owns". Where the Scope does not hold, the rule says nothing.
- **Statement.** One ruling, with one modal verb, capitalized: MUST, MUST NOT, SHOULD, SHOULD NOT,
  MAY. No other modal, no "always", "never", "only", "by default". Two rulings are two rules.
- **Relies on.** What the rule takes as given from other rules: one line per rule, its id and
  what that rule's Scope and Statement guarantee, in its terms, never what its Why argues:
  `- TX-5: a repeated delivery changes nothing.` Direct only, not what the named rule relies on
  in turn; no glossary terms, whose changes sweep every tier anyway. `—` where the rule relies on
  none. A rule that needs what only another rule's Why says has found a gap in that rule's
  Statement, and an issue records it. A line is no second statement of the named rule: it states
  what this rule assumes, and where the two disagree, the named rule stands and the line is the
  finding.
- **Why.** The harm the rule prevents and how it comes about, as long as that takes. It takes the
  Relies-on lines as given and argues this rule alone. Contains no ruling: no modal verb, no
  "only" or "never"; a Why that rules is a Statement in hiding. Breach examples show the harm
  happening. Required.
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
- **MAY**: a permission. It exists where another rule would otherwise forbid; its Relies on names
  that rule.

### Exceptions

A rule has no exceptions inline. Where a situation needs a different ruling, that is another rule
with a narrower Scope, usually a MAY. Where the Scopes of two rules both hold, the narrower Scope
governs: a MAY against a MUST is not a deviation, it is the more specific ruling. The MAY
announces itself as an exception.

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
- **Contradiction.** Finds one situation where complying with one rule is the breach of another,
  and no code satisfies both. Produces the pair of examples that shows it, each satisfying one
  rule and breaching the other. No script checks this; an example that happens to satisfy one
  rule and breach another is a defect, not a contradiction.
- **Adversarial.** Satisfies a Statement while causing the harm in its Why. Produces a breach
  example the Statement alone would call ok. This is the reader that tests Why.

Every reader also checks each Relies-on line of the rules it reads against the Scope and
Statement the line names. A line they do not guarantee is a finding: an issue records it.

## Tiers

The documents depend downward: general rules use the glossary; group rules use both; examples
are referenced from both. The cost of a change rises with the tier.

- **Glossary.** Adding a term is cheap. Changing one —
  rewording, narrowing, dropping — is an issue, and a fresh session works it: it sweeps every
  lower tier for the term and re-decides whatever the change touched, inside that issue.
- **General rules.** Changing a rule's Scope or Statement is an issue that also visits every
  rule, general or group, whose Relies on names it. Changing Relies on, Why, Provenance or
  Examples is not.
- **Group rules.** Changeable without touching the tiers above. Where a situation cannot be ruled
  without changing a general rule or a term, the same issue makes that change, upward, under the
  rules of the tier it touches.

## Peer review

Only when one is requested. Each type has one goal; a request names the goal, and only that type
runs. A reviewer is a subagent given only the files its type lists, never the conversation, the
issues or the other documents; it writes what it finds to a temporary file for the requester to
read. A finding the requester accepts goes into an issue.

- **Fresh repo, twice.** Goal: tell where `the-world.md` leaves a choice open on purpose from
  where a reader can take it two ways. Two subagents each get `glossary.md`, `the-world.md`, that
  both draw on Evans, Cockburn and Khononov, and the same product brief: the fixture's
  capabilities and technologies, never its systems or edge cases. Each drafts an architecture:
  systems and what each owns, ports and adapters, calls and messages, processes, a directory
  tree, how each property holds, and every decision the two documents left to it. Where the
  drafts differ, either the world leaves the choice open, fine, or one of its sentences reads two
  ways, a finding.
- **Red team.** Goal: find what `the-world.md` should rule out and does not. One subagent gets
  `glossary.md` and `the-world.md` and designs architectures that hold every property and are
  plainly bad: a distributed monolith, every system reading one shared schema, one system owning
  everything. Each design that holds is a finding: a force or a property missing.

## Working here

1. Read `glossary.md` and `general-rules.md` whole before anything else; group files for the
   situation at hand. Never the issue files, unless working one.
2. Terms are used exactly as the glossary spells them. No synonyms, no second word for the
   same thing. A word with meaning the glossary does not give it appears only if it is common
   language or a source's well-known term. A rule that needs a new word adds it to the glossary,
   as a definition, first.
3. One ruling per rule. Another document refers to a rule by id, never by restating it; a
   Relies-on line is no restatement (Rule shape).
4. Changing a rule's Scope or Statement, find every Relies-on line that names it and ask of each
   whether the changed rule still guarantees it; each no is part of the same issue. Writing or
   changing a rule, check that its own Relies-on lines still hold, and add one for each rule its
   new text leans on.
5. Work in batches, not sentence by sentence: one session drafts a tier whole, one runs the
   readers over it. A draft is done when every rule has its examples and the readers produce no
   new example.

## Source material

`registry/docs/agents/layers-revised.md`, `layers-revised-examples.md`, `layers-revised-review.md`
and `layers-revised-provenance.md` are the pass-1 translation of the old document: deduplicated,
with ids, but still in the old vocabulary and with general and specialized rules in one file. They
are the source the documents here are extracted from, and they go once extracted. Nothing here
references them otherwise.
