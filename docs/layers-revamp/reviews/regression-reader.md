# Regression reader

One subagent, run after a change to `glossary.md`, `the-world.md` or `general-rules.md` lands,
before the next step. It answers one question: against the last review's cooperative findings,
did this change resolve, leave or break anything. It discovers nothing; the Implementer and the
Fresh repo readers do that, once per spec (README, Testing). Tiers:

1. `node docs/layers-revamp/affected.mjs <base> <head>`: the affected set, mechanical. Stored as
   `reviews/NN/regression/<issue>-affected.md`.
2. This reader, over the affected set. Stored as `reviews/NN/regression/<issue>.md`.
3. The regular readers, once per spec, as `reviews/NN+1/`.

## Prompt

Fill the angle brackets. Absolute paths; the agent does not `cd`. Opus, effort high.

```
You check whether a change to a set of rules resolved known findings, and whether it broke
anything that held. You discover nothing new: a problem the change did not cause is not yours
to report.

Read whole, in this order:
1. <abs>/docs/layers-revamp/reviews/<NN>/distilled.md — the rules as the last review read them.
2. The diff: run `git -C <abs> diff <base> <head> -- docs/layers-revamp/glossary.md
   docs/layers-revamp/the-world.md docs/layers-revamp/general-rules.md`.
3. <abs>/docs/layers-revamp/reviews/<NN>/regression/<issue>-affected.md — the affected set.
4. <abs>/docs/layers-revamp/reviews/<NN>/checklist.md — the findings, one id each.
5. <abs>/docs/layers-revamp/issues/<issue>.md — what the change meant to do (Decision).
6. The previous builds, for the systems the change touches:
   <abs>/docs/layers-revamp/reviews/<NN>/raw-implementer.md, section "How the fixture is built";
   <abs>/docs/layers-revamp/reviews/<NN>/dist-implementer.md, the same section.
7. Every example file the affected set names, under <abs>/docs/layers-revamp/examples/.
8. <abs>/docs/layers-revamp/domain.md, for the fixture's facts.

Judge from Scope and Statement of the rules as they now stand (the diff applied to the
distilled), with the glossary as it now stands. Why, Relies on and Provenance bind nobody.

Write <abs>/docs/layers-revamp/reviews/<NN>/regression/<issue>.md:

## Checklist
One line per checklist id, every id, in order: `- R<NN>-k: resolved | unchanged | newly broken |
out of scope — <one sentence why, naming the rule or term>`. "Out of scope" means the change
touched nothing the item hangs on. "Resolved" means the code or situation the item names now
satisfies the rules as written, or the rule no longer holds for it; say which.

## Examples in the affected set
One line per file: `- <file>: holds | breach | scope fails — <rule, one sentence>`. An ok file
is judged against every rule, not the ones it lists. A breach file that now reads as ok is a
loosened rule, or your misreading; say which you believe and why. If more than two breach files
flip, stop and report that your judgement may have drifted.

## Previous builds
Per changed rule or term, what in the two builds' code for the touched systems now breaches
or now complies that did not before. Cite the system and the snippet's heading.

## Newly broken
Everything marked newly broken above, each with the smallest code that shows it, as an example
file body (front matter `breaches`, `satisfies`, `situation`, `finding: regression`). Nothing
else: a gap you noticed that the change did not cause goes in one line under "Noticed", at most
five lines, no example.

## Noticed
See above.

Be terse. Cite rule ids and glossary terms as spelled. Do not propose rewordings.
```

## After it runs

- `newly broken` items are fixed before the step is checked, or opened in the next issue by
  name; neither silently.
- `resolved` items need no edit anywhere: the checklist keeps the line, the regression file is
  the record.
- A glossary or world change also gets two Fresh repo drafts over the regenerated distilled
  glossary and world (README, Peer review), since a term's second reading shows in a draft, not
  in a re-judged example. A rules-tier change does not.
