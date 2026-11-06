# Regression reader

One subagent, run after each change round to `glossary.md`, `the-world.md` or `property-rules.md`,
before the next round. Fast, where a Fresh draft is slow: it proves the round closed what it
targeted and broke nothing, anywhere in the docs, not only in the entries the round touched. It
discovers nothing new; the Fresh drafts do that, once per review (`reviews/NN/`).

Broken means one of:
- a build that complied now breaches, or one that breached now complies;
- a property of the world the rules delivered that they no longer deliver: a build that now
  complies and violates it (a loosened rule);
- two rules or a rule and the glossary that now contradict, or a term a binding text uses that
  lost its meaning;
- the distilled output itself: a field, heading or rule dropped, or undistilled text leaked in.

## Setup, in the requester's session

Placeholders: `${ROOT}` the absolute path of `docs/layers-revamp`; `${NAME}` the round's topic,
`p13-kernel-crossing`; `${NN}` the last review, the highest `reviews/NN/`; `${BASE}` the head of
the previous regression file (its first line), `${HEAD}` the round's commit.

1. The round committed; tree clean.
2. `node ${ROOT}/affected.mjs ${BASE} ${HEAD} > ${ROOT}/reviews/${NN}/regression/${NAME}-affected.md`.
3. `${ROOT}/distill.mjs` run at `${HEAD}` (a worktree) into
   `${ROOT}/reviews/${NN}/regression/${NAME}-distilled.md`.
4. The reader, below; Opus, effort high, in the background. The requester goes on meanwhile.
5. Commit the three files and the report: `docs(layers-revamp): regression, ${NAME}`.

## Prompt

Fill the placeholders. `${FINDINGS}` lists the ids the round targets and where their details are.
Name no intent beyond that and ask no leading question: the reader works out from the diff what
the round does.

```
You check whether a change to a set of rules closed the findings it targets, and whether it broke
anything anywhere in the rules. You discover nothing new: a gap the change did not cause is not
yours to report.

ROOT = ${ROOT}. Absolute paths; do not cd.

Read whole, in this order:
1. ${ROOT}/reviews/${NN}/regression/${NAME}-distilled.md: the rules at head, whole.
2. The diff: `git -C ${ROOT}/../.. diff --word-diff ${BASE} ${HEAD} -- docs/layers-revamp/glossary.md
   docs/layers-revamp/the-world.md docs/layers-revamp/property-rules.md`.
3. ${ROOT}/reviews/${NN}/regression/${NAME}-affected.md: where the changed text and terms occur.
   Mechanical: a rule can be affected without sharing a word.
4. The targeted findings: ${FINDINGS}.
5. The builds ${ROOT}/reviews/${NN}/dist-fresh-a.md and ${ROOT}/reviews/${NN}/dist-fresh-b.md, whole.
6. ${ROOT}/reviews/${NN}/brief.md, for facts.

Judge from Heading, Scope and Statement as they now stand, with the glossary and the world's
headings and Except. Why, Relies on and Provenance bind nobody. Read as a well-meaning implementer
who tries to build what makes sense. A split is two readings such an implementer could plausibly
build either way; a reading that needs ignoring what the rule plainly asks for, or what the code
could plainly see, is not a split.

Broken means: a build that complied now breaches, or that breached now complies; a property of
the world the rules delivered that a complying build can now violate; two binding texts that now
contradict; a term a binding text uses that lost its meaning; the distilled output damaged.

The world states properties; each rule exists to deliver one, and every sentence of it should serve
that property. A sentence filed under a property it does not serve sits beside rules that do, looks
at home, and is judged against the wrong neighbours; the property it does serve has rules elsewhere,
and the two contradict without sharing a word. A sentence removed or weakened can leave a property
no Statement delivers, again without sharing a word with the rule that names it. So judge each
change by what it delivers, not by where it sits or which words it shares. The way to go about it,
in general: for each changed sentence, name the property it delivers; where that is not its rule's
property, it is misplaced: report it, and judge it against the rules of the property it delivers.
For each sentence removed or weakened, name what it delivered and which Statement still does; where
none does, that property is broken. Use your own measure where this way misses what the reason
asks.

Write ${ROOT}/reviews/${NN}/regression/${NAME}.md. First line `Base ${BASE}, head ${HEAD}.`, then
`Changed: ...`, one line, in your words.

## Targeted findings
Per id: resolved | unchanged | newly split, one sentence naming the rule or term.

## Every rule
One line per rule P1–P19, per world property, per glossary entry: `unaffected` or
`affected: <why, one sentence>; holds | broken`. A rule is affected where it shares a word with a
change, or a property with a changed sentence, or delivered what a removed one delivered. For each
affected, say what a build could do before and after. A misplaced sentence near the change that the
change did not cause goes under Noticed.

## Builds
Fresh A, Fresh B: what now breaches or complies that did not before, citing the section.

## Newly broken
Each broken item with the smallest code that shows it, as an example body (front matter
`breaches`, `satisfies`, `situation`, `finding: regression`). "none" if none.

## Noticed
At most four lines: gaps the change did not cause.

Terse. Cite rule ids and glossary terms as spelled. Do not propose rewordings.
```

## Calibration

Now and then the requester runs the reader on a canary: a commit, on no branch, that breaks
something known, described to the reader like any round. A reader that reports the canary clean
is too friendly; the prompt is fixed before the next real round.

## After it runs

- Newly broken items are fixed in the next round, or named in the next review; neither silently.
- Resolved items need no edit: the regression file is the record.
- The Fresh drafts run again before the next review, over the rules as they then stand, not after
  every round.
