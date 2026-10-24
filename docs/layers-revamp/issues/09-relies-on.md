# 09 — Relies on

**Status:** closed

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

- Every general rule carries `*Relies on:*` after Statement, `—` for 14. Whys trimmed of what
  the lines carry; cites left in a Why are lines. Reverse cites dropped (TX-5 no longer cites
  TX-20, TX-21; TX-1 no longer SVC-2, ASM-9).
- Cycles allowed: TX-1 relies on TX-2 (writes land together only if adapters write inside the
  handed transaction), TX-2 on TX-1 (there is one to write inside).
- Delivery chain spelled out where a Why argues it itself: TX-3, TX-15, TX-22 name TX-6, TX-20,
  TX-21, DRV-7, TX-5 directly.
- TX-5's line everywhere: "a repeated delivery changes nothing".
- README: Exceptions said the MAY's id sits in its Why, against Strength; the clause is gone,
  Strength states it. Testing gains the issue 08 check: every reader checks each Relies-on line
  against the Scope and Statement it names; a line they do not guarantee is a finding.
- No other README lead proved wrong.
- Review fixes: SVC-4's Why keeps the repository saving its aggregate whole (glossary); SVC-1's
  Why loses the driving port's importers loading none of its service, which SYS-10 holds for
  export paths only; TX-1's Why loses a check and its write seeing the same state (issue 10).

## Consequences

Gaps found, a line needing what only a Why says, or no rule saying it. Lines written against the
Statements as they stand.

- To issue 10: reads in the transaction, `TX-2`'s Scope being writes; isolation, `SVC-2` needing
  check and act to see the same state where `TX-1` guarantees one transaction; an answering port
  handed a downstream's transaction.
- To issue 01: a message's id kept across repeats; the order `TX-19`'s Why has the publisher put
  on messages; what a published language's and a shared kernel's modules import; the open host
  service's schemas and errors kept compatible.
- Closed here. `TST-9` retired: a MAY excepting nothing, `TST-11`'s Scope needing two downstreams;
  Vocke moved to `TST-11`'s Provenance. `DOM-3`'s Why called `SYS-2`'s Scope narrower; the
  published language shapes no record, so it falls outside `DOM-3`'s Scope. `SYS-2`'s Why had the
  service translate, which only `SVC-6`'s Why says; the translation fails to compile wherever it
  sits.
- Not gaps. A writing use case's driving port takes no transaction: `TX-1`'s "open it" rules it.
  The glossary's Factory names an adapter's constructor a factory "for a driven port"; its first
  sentence covers driving adapters.
