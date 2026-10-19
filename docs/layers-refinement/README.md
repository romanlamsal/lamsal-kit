# Refinement work

How documents in `registry/docs/agents/` get refined in this repository. The steps for changing
`layers.md` itself are in `docs/extending-layers.md`; this folder holds the efforts that feed it.

## Layout

- `spec-NN.md`: the map of one effort — destination, order, every ticket's status, gaps ruled
  out. Read it to find the next open ticket without opening each one.
- `NN-<slug>.md`: one ticket, self-contained: status, context, problem, resolution, grounding,
  done when. Its `**Status:**` line and its row in the spec always agree.
- `open-questions.md`: decisions not made yet; each becomes a ticket once grilled.
- `domain.md`: the review domain whose edge cases tickets refer to.

## Picking up a ticket

1. Read `registry/docs/agents/layers.md` whole, `docs/extending-layers.md`, `domain.md`, and the
   spec that lists the ticket.
2. Work the ticket through the steps of `docs/extending-layers.md`. A ticket's proposed wording
   is a draft: it passes the four tests and the step-5 sweep before it goes in.
3. Record the resolution the grilling reached as a `## Decision` section at the end of the
   ticket, written as an ADR in the `domain-modeling` skill's format (its `ADR-FORMAT.md`): what
   was decided, in what context, and why; considered options and consequences only where they
   add value. An open question resolves the same way, in the ticket it becomes.
4. Present the change and wait for approval before committing, per `CLAUDE.md`.
5. Set the ticket's `**Status:**` line and its row in the spec to `closed (<commit>)`, and
   unblock whatever it blocked, in both places.

Done when the ticket's own "Done when" holds, its `## Decision` section is written, and both
status places show the commit.

## Grilling an open question

Open the first round with context the author may not hold: the rule in `layers.md` the question
touches, the `domain.md` case that breaks it, and what each ticket it blocks or relates to says.
Ask one decision per question; walk a choice of order or mechanism through a concrete failure in
`domain.md`.

- Ask about the general concept; use `domain.md` to test it, not to frame it.
- Run the four tests on every proposed sentence before asking about it, and show the results.
  Run them again on the final wording of every decision before applying it.
- Before proposing wording, read what the author already ruled in the text around it; a
  distinction there may be deliberate.
- Ask what a section is meant to achieve before fixing it; the text may predate the concepts that
  now strain it.
- Name a checklist question by its title, not only its number.
- Where a rule forces a flow the author may not see, walk the flow step by step before asking.
- Ask what `layers.md` will say. Only `layers.md` ships: a choice the consuming repository must
  make has to be stated there, not only in a ticket's Decision.
- Leave to the consuming repository what it should decide: no fixed counts, no required code
  structure, no mechanism. State such a choice positively ("can be correct", "each codebase's
  choice") rather than leaving it unsaid.
- Say when a term is coined rather than taken from a book.
- Challenge a design the author brings against the sources before asking about wording.
