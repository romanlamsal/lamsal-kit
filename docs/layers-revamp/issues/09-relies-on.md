# 09 — Relies on

**Status:** open

## Context

Agents working an issue alone revise rules and add new ones. A rule leans on others, and an edit
up the chain can leave a gap in a rule whose text names nothing of the edit. The Whys cite rule
ids, but a cite does not say which way it points (`TX-5` cites `TX-20` and `TX-21`, which rely on
it), and most reliance goes uncited (`SVC-6` on `SVC-1`, `SVC-4`, `SYS-1`). A bare list of ids
says where to look, not whether a change there matters. Order: `specs/01-work-order.md`, step 4.

Settled when it was opened:

- Each rule gets a field, `*Relies on:*`, one line per rule it relies on, stating what that rule
  guarantees, in its terms:

  ```
  *Relies on:*
  - TX-5: a repeated delivery changes nothing.
  ```

  The check is the line: `TX-5` weakened to SHOULD, the guarantee goes and `TX-20` is affected;
  `TX-5` reaching idempotence by a status set instead of recorded ids, the guarantee stands and
  `TX-20` is untouched.
- A line cites only what the other rule's Scope and Statement guarantee, never its Why: Scope and
  Statement are the rule. A rule that needs what only another's Why says has found a gap in that
  Statement.
- The Why takes its rule's Relies-on lines as given and argues only what its own rule is for.
- Self-review by the agent, no script. Editing rule B, it greps the Relies-on lines naming B and
  asks of each whether B still guarantees it; a no puts that rule in the issue. Editing rule A, it
  checks A's lines still hold, and adds one where A's new text leans on another rule.
- The other direction, which rules rely on B, is a grep, never written down.
- Tossed: a first pass by one agent per section listed what leaving B out breaks in A, 108 edges
  as bare ids. A different question; its edges cannot be checked against an edit to B.

## Problem

- The README's rule shape gains the field: its place among the parts (lead: after Statement,
  before Why), and `—` where a rule relies on none.
- README, Working here 3, "never by restating it": a Relies-on line restates what another rule's
  Statement guarantees. The field is exempt, or the line states only what follows from the
  Statement.
- README, Tiers: "visits the group rules whose Why names it" becomes the rules, general and group,
  whose Relies on names it; whether group rules carry the field.
- README, Strength: a MAY's Why names the rule it excepts. Whether that moves into Relies on: the
  MAY relies on that rule's Scope covering its case.
- Glossary terms stay out of the field (lead): every rule uses many, and changing a term already
  sweeps every tier.
- Direct edges only (lead): A relies on B, not on what B relies on.
- Write the field for all 51 rules, then trim each Why of what its lines now carry. Where a line
  needs what only another rule's Why says, the gap is recorded, here or in a new issue, instead of
  the line.
- Issue 08's readers gain a check: each Relies-on line holds against the Statement it names.

## Decision

—

## Consequences

—
