# Regression reader

One subagent, run after a change to `glossary.md`, `the-world.md` or `general-rules.md` lands,
before the next step. It answers one question: against the last review's cooperative findings,
did this change resolve, leave or break anything. It discovers nothing; the Implementer and the
Fresh repo readers do that, once per spec (README, Testing). Tiers:

1. `node docs/layers-revamp/affected.mjs <base> <head>`: the affected set, mechanical. Stored as
   `reviews/NN/regression/${ISSUE}-affected.md`.
2. This reader, over the affected set. Stored as `reviews/NN/regression/${ISSUE}.md`.
3. The regular readers, once per spec, as `reviews/NN+1/`.

## Setup, in the requester's session

Placeholders: `${ROOT}` the absolute path of `docs/layers-revamp`; `${ISSUE}` the issue file's
basename without `.md`, `20-glossary-sweep`; `${NN}` the last review, the highest
`reviews/NN/`; `${BASE}`, `${HEAD}` shas.

1. Tree clean.
2. `${HEAD}`: the commit that closed the issue,
   `git log --format=%h -S'**Status:** closed' -- ${ROOT}/issues/${ISSUE}.md`; one sha. Not
   necessarily the current HEAD.
3. `${BASE}`: the last state judged. The `Head` sha in the newest file of
   `${ROOT}/reviews/${NN}/regression/` that is not an `-affected.md`; none yet, the sha
   `reviews/${NN}/SUMMARY.md` cites as the state it read. Where `${BASE}` is not an ancestor of
   `${HEAD}`'s parent, say so and use `${HEAD}^`.
4. `node ${ROOT}/affected.mjs ${BASE} ${HEAD} > ${ROOT}/reviews/${NN}/regression/${ISSUE}-affected.md`.
5. The reader, below. It writes `${ROOT}/reviews/${NN}/regression/${ISSUE}.md`, first line
   `Base ${BASE}, head ${HEAD}.`; the next run reads it in step 3.
6. Commit the two files: `docs(layers-revamp): regression, issue <N>`.

## Prompt

Fill the placeholders. Absolute paths; the agent does not `cd`. Opus, effort high.

```
You check whether a change to a set of rules resolved known findings, and whether it broke
anything that held. You discover nothing new: a problem the change did not cause is not yours
to report.

Read whole, in this order:
1. ${ROOT}/reviews/${NN}/distilled.md — the rules as the last review read them.
2. The diff: run `git -C ${ROOT}/../.. diff ${BASE} ${HEAD} -- docs/layers-revamp/glossary.md
   docs/layers-revamp/the-world.md docs/layers-revamp/general-rules.md`.
3. ${ROOT}/reviews/${NN}/regression/${ISSUE}-affected.md — the affected set.
4. ${ROOT}/reviews/${NN}/checklist.md — the findings, one id each.
5. ${ROOT}/issues/${ISSUE}.md — what the change meant to do (Decision).
6. The previous builds, for the systems the change touches:
   ${ROOT}/reviews/${NN}/raw-implementer.md, section "How the fixture is built";
   ${ROOT}/reviews/${NN}/dist-implementer.md, the same section.
7. Every example file the affected set names, under ${ROOT}/examples/.
8. ${ROOT}/domain.md, for the fixture's facts.

Judge from Scope and Statement of the rules as they now stand (the diff applied to the
distilled), with the glossary as it now stands. Why, Relies on and Provenance bind nobody.
Read as a well-meaning implementer who tries to build what makes sense. A split is two readings
such an implementer could plausibly build either way; a reading that needs ignoring what the rule
plainly asks for, or what the code could plainly see, is not a split and not a finding.

Write ${ROOT}/reviews/${NN}/regression/${ISSUE}.md. First line: `Base ${BASE}, head ${HEAD}.`

## Checklist
One line per checklist id, every id, in order: `- R${NN}-k: resolved | unchanged | newly broken |
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

## Fresh session

> Run the regression reader per `docs/layers-revamp/reviews/regression-reader.md` for issue <N>.
> Setup, then the reader; show me its Checklist section and stop before committing.

The session reads the README first (Working here, 1), then this file. It derives the shas; the
requester names only the issue.

## After it runs

- `newly broken` items are fixed before the step is checked, or opened in the next issue by
  name; neither silently.
- `resolved` items need no edit anywhere: the checklist keeps the line, the regression file is
  the record.
- A glossary or world change also gets two Fresh repo drafts over the regenerated distilled
  glossary and world (README, Peer review), since a term's second reading shows in a draft, not
  in a re-judged example. A rules-tier change does not.
