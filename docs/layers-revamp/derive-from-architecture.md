# Deriving rules from an architecture, not from rules

*Procedure note, 2026-11-01.* Written during review 04, before its readers returned. Not a spec
and not an issue; a restart plan to pick up if property-rules.md as drafted does not read well.

## Why

The rules grew from 67 to 88 by closing review findings one at a time, each close landing in a
Scope, a Statement or a new rule. The findings were fixture cases, so the rules came to describe
cases. property-rules.md tried to undo that by writing one rule per property, but its writers had
general-rules.md open as a quarry, and compressed it instead of restating the mechanism. Closing
the quarry for a Statement rewrite helped less than expected, because the Whys had been written
with it open too.

The-world underdetermines the rules: forces are facts and properties are goals, but many
architectures satisfy all 19. What general-rules.md carried, under the case detail, was this
codebase's choices between them. Any derivation that starts from the-world alone makes those
choices again, once per writer, and the writers disagree at the seams (P7 against P10, P2
against P3 in the draft).

So the input a rule writer needs is the architecture, with its choices made, at the altitude
the-world is written at: systems, layers, relations, communication. Not code, which overfits
the fixture and has to be written and reviewed first; not rules, which anchor. An architecture
at that altitude is a few hundred lines, checkable in an hour, and every rule derived from it
delivers a property through a mechanism the architecture already shows.

## What to aim for

- One rule per property, id Pn, Statement of at most three sentences naming one mechanism and
  no case. P16 in property-rules.md is the shape. Cases live in the Why and in examples.
- Static rules from the static artifact, dynamic rules from the traces. No rule reaches for a
  case the artifacts do not contain; a case the artifacts miss is added there first.
- The fixture's edge cases appear as grid cells and later as examples, never as Statement
  clauses.
- Both old rulebooks are oracles after the fact, opened by the requester, never by a writer.

## The two artifacts

Properties split by what they are about.

Static, visible without running anything: P1, P2, P3, P5, P6, P12, P13, P19. Which systems
exist and of what kind; which layers each has; which module may import which; who implements a
port for whom; what each system offers and to whom; where business rules sit; what the shared
kernel and the common library hold; how each system is tested. The Fresh-repo draft format
(`reviews/regular-review.md` §2, Fresh repo) is this artifact's shape already: systems table,
ports and adapters, calls and messages, processes, directory tree.

Dynamic, visible only in a use case trace: P4, P7, P8, P9, P10, P11, P14, P15, P16, P17, P18. A
trace is one use case, step by step: which driving adapter translates what into which driving
port; which service opens the transaction; which domain rule decides; which driven ports are
called, implemented by whom; what is written, where the outbox write sits; what crosses to
another system, as call or message, in whose published language; who acknowledges; what
returns. Ten to fifteen lines each.

Each trace is then run against the forces. One line per cell where a mechanism is needed:

| step | F1 | F2 | F3 | F4 process dies after | F5 delivered again / out of order |
| --- | --- | --- | --- | --- | --- |
| 3 shop writes ReserveStock to outbox | | | | message and order commit together, P8 | |

A cell names the property the mechanism delivers. Where the same cell shape recurs across
traces, that is the rule. Where it does not recur, it is an example.

Negative space: beside any step that could have gone another way, one line `not: <the other
way>` with the reason in a few words. These lines are the MUST NOTs and replace `choices.md`
for the rules' purposes.

## Steps

1. **Static artifact.** Take the Fresh draft closest to `choices.md` from reviews 03 or 04.
   Correct it by hand into the architecture we mean. Add the `not:` lines where a choice was
   made. Commit as `docs/layers-revamp/architecture.md`.
2. **Traces.** One per use case of `domain.md`, about a dozen: place product, checkout by card,
   checkout by invoice, confirmation mail, deadline cancel, refund, dispute, invoice on payment,
   bank transfer match, dunning, reservation and release, shipment webhook, the dashboard reads,
   health and metrics. Written by the requester, or drafted by an agent from the static artifact
   and corrected. Commit beside the static artifact.
3. **Grid.** Run each trace against F1 to F5. Fill only cells that need a mechanism. Name the
   property per cell. Check every dynamic property has at least one cell and every static
   property at least one line of the static artifact; a property with neither is either
   delivered by the architecture for free (say so) or the artifacts are missing something.
4. **Derive.** One writer per property, or one writer for all 19 if coherence matters more than
   parallelism. Inputs: glossary, the-world's Pn, the static artifact, the traces and grid cells
   naming Pn, the `not:` lines. No rulebook, no examples, no reviews, no fixture beyond what the
   traces carry. Output: Scope, Statement (≤3 sentences, no semicolons, no case), Why written
   from the mechanism the grid shows, one example per grid cell with Pn in it. Rule on
   mechanism, trust neighbouring properties, use glossary terms as spelled, define nothing
   inline.
5. **Oracle.** Requester opens general-rules.md and property-rules.md and lists every old id no
   new Statement delivers. Decide per id: example, Why sentence, gone, or a clause after all.
   Expect most to be examples or gone.
6. **Distill and review.** `distill-properties.mjs` over the new file. Implementer over
   distilled plus `domain.md`; two Fresh drafts over distilled plus `brief.md`. The Implementer
   is a weaker test here, since the traces are the shop's, but it still tests whether the
   Statements say what the traces meant. The Fresh drafts are the clean test. Compare to
   review 03 and 04 counts.

## What this does not fix

The glossary. Writers of property-rules.md asked for Transaction to be defined and for Owner,
Shared kernel, Common library, Offer and Courier to carry what Statements now carry. The
architecture makes those requests concrete but does not answer them; a glossary pass follows
step 5.
