# Layers revamp

A rewrite of `registry/docs/agents/layers.md` with a different structure. The old document grew
until changing one sentence made an unrelated paragraph stale: rules were restated in several
places, exceptions were carved out at the rule and again at the exception, provenance and
examples sat inside the rules. This folder rebuilds it as several small documents, each with one
job, and no sentence stated twice. The documents here are the input: what gets checked for gaps,
inconsistencies and contradictions. A repository receives the output of `distill.mjs`, nothing else
of this folder.

## Documents

- `glossary.md`: definitions only, read as a whole. A sentence stays in a definition where it
  tells the term from a neighbouring term; one that says what the thing must or must not do
  beyond that is a rule and leaves.
- `the-world.md`: forces, what the world does to a system, and properties, what holds anyway. It
  names no mechanism and no rule; the property rules are one set that delivers the properties.
  Glossary vocabulary.
- `property-rules.md`: one rule per property of the world, read whole. Glossary vocabulary.
- `domain.md`: the fixture. A made-up shop with the situations the rules are tested against.
  Situations only, no rulings. The brief of each review is built from it.
- `issues/NN-<slug>.md`: work items. `**Status:**` line; Context and Problem when opened,
  Decision and Consequences when closed, closed with the commit that landed it. The issue files
  are the only record of decisions; there is no index.
- `specs/NN-<slug>.md`: an order to work issues in, as numbered steps. A session told "the next
  in the spec" works the first unchecked step and checks it in the commit that lands it.
- `distill.mjs`: generates what a repository receives: the glossary and the world whole, then
  `property-rules.md` without its author-only parts (Absorbs, Drops, Glossary notes, Terms used,
  the Appendix). `node docs/layers-revamp/distill.mjs > distilled.md`.
- `reviews/NN/`: what a review's readers wrote, and the distilled they read. The issues are the
  record of what the requester accepted. `reviews/NN/checklist.md`: the review's cooperative
  findings, one id each; `reviews/NN/regression/`: what the regression reader found after each
  step that followed the review.
  `reviews/regular-review.md`: how a review is run, regular (two Fresh drafts) or fat (six
  readers), the prompts verbatim; a fresh session runs one from it.
  `reviews/regression-reader.md`: the cheaper check between reviews.
- `affected.mjs`: the affected set of a change, mechanical: changed terms, properties and rules,
  where each changed term is used, and the last review's example bodies whose rule changed.
  `node docs/layers-revamp/affected.mjs <base> <head>`.

## Rule shape

One rule per property of the world, under the property's heading. Scope and Statement are the
rule, read as one unit; a Statement is never judged alone.

- **Scope.** The situation the rule governs, in prose. Where the Scope does not hold, the rule
  says nothing.
- **Statement.** The rulings that deliver the property, each with a capitalized modal verb: MUST,
  MUST NOT, SHOULD, SHOULD NOT, MAY. Every sentence serves the rule's property; one that serves
  another property belongs in that property's rule.
- **Why.** The harm the rule prevents and how it comes about, for a session changing the rule.
  Contains no ruling; a Why that rules is a Statement in hiding. Required.
- **Provenance.** Sources outside this repo: what the rule follows, where it departs from them.
  Never this repo's own history; that lives in git and the issues.
- Author-only, dropped by the distiller: Absorbs, Drops, Glossary notes, Terms used, and the
  Appendix.

### What binds

A repository reads the distilled output. What binds is the glossary, the world's headings and
Except, and the rules' Heading, Scope and Statement. Why and Provenance bind nobody, and a gap
never closes in either. The test for a Why: a reader given Scope and Statement alone refuses every
breach the Why describes; a breach only the Why refuses is a gap in the Statement.

Nothing that binds names instances of what it speaks of: not after a colon, not in a series, not
one. A list in a ruling goes stale and reads as closed. A series whose members can each be swapped
for another of their kind is a list of instances. One whose members together are the whole of what
the term means, so that dropping one changes the meaning, is the definition and stays. Why,
Provenance and `domain.md` may name instances.

### Strength

The modal verb is the ruling's strength.

- **MUST**, **MUST NOT**: no deviation. A codebase that cannot comply changes the rule, through
  an issue.
- **SHOULD**, **SHOULD NOT**: the default; a codebase deviates. A deviation that recurs reopens
  the rule.
- **MAY**: a permission where another ruling would otherwise forbid.

## Reviews

Only when one is requested, and before each next review is due; `reviews/regular-review.md` has
the prompts. A reader is a subagent given only the files its prompt lists, never the conversation,
the issues or the other documents; it writes what it finds to `reviews/NN/`. A finding the
requester accepts goes into an issue.

- **Regular: Fresh repo, twice.** Two subagents each get the distilled set and the same product
  brief: the fixture's capabilities and technologies, never its systems or edge cases. Each
  drafts an architecture and lists every decision the document left to it and every sentence it
  had to pick a reading for. Where the drafts differ and each holds every property, the document
  left it open; where a sentence reads two ways, a finding.
- **Fat: six readers.** The two Fresh drafts, two more over the raw files, and the Implementer
  over each set: it builds the fixture, `domain.md`, under the rules, and a finding is wherever a
  rule cannot be followed.
- **Between reviews:** the regression reader (`reviews/regression-reader.md`). `affected.mjs`
  lists what a change touches; one reader proves the change closed what it targeted and broke
  nothing anywhere in the rules. It discovers nothing; the reviews do.

## Tiers

The documents depend downward: the glossary and `the-world.md` on top, the property rules below.
The cost of a change rises with the tier.

- **Glossary.** Adding a term is cheap. Changing one, rewording, narrowing, dropping, sweeps
  every lower tier for the term and its old wording, starting with `affected.mjs`, and re-decides
  whatever the change touched.
- **The world.** Changing a force or a property reads every rule against the change.
- **Property rules.** Changing a Scope or Statement is checked by the regression reader before the
  next change. Changing a Why or Provenance is not.

## Working here

1. Read `glossary.md`, `the-world.md` and `property-rules.md` whole before anything else. Never
   the issue files, unless working one.
2. Terms are used exactly as the glossary spells them. No synonyms, no second word for the
   same thing. A word with meaning the glossary does not give it appears only if it is common
   language or a source's well-known term. A rule that needs a new word adds it to the glossary,
   as a definition, first.
3. Another document refers to a rule by id, never by restating it.
4. A gap closes in a Scope or a Statement, never in a Why. A rule with no property behind it means
   a property is missing, not the other way round.
