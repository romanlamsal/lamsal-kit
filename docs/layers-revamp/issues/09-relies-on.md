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
- The README states the shape this issue delivers, its leads taken: the field after Statement,
  `—` where none, direct edges only, no glossary terms, a MAY naming the rule it excepts there,
  group rules carrying it too, the line exempt from restating (Working here 3), the self-review
  (Working here 4), Tiers visiting the rules whose Relies on names the changed rule.
- Tossed: a first pass by one agent per section listed what leaving B out breaks in A, 108 edges
  as bare ids. A different question; its edges cannot be checked against an edit to B.

## Problem

- `general-rules.md` does not carry the shape the README states yet.
- Write the field for all 51 rules, then trim each Why of what its lines now carry. Where a line
  needs what only another rule's Why says, the gap is recorded, here or in a new issue, instead of
  the line.
- A README lead that writing the lines proves wrong is revised here.
- Issue 08's readers gain a check: each Relies-on line holds against the Statement it names.

## Decision

—

## Consequences

—
