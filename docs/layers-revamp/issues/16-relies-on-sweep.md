# 16 — Relies-on sweep

**Status:** open

## Context

Every reader checks each Relies-on line against the Scope and Statement it names (README,
Testing). The full review's raw set (spec 02) found lines that claim more than the named rule
guarantees. The README has the named rule stand and the line be the finding; where a Why needs
the claim, the gap is the named rule's. Order: `specs/02-review-findings.md`, step 7, after
every Scope and Statement change, since the lines claim against them.

Settled when it was opened:

- The sweep reads every line of every rule, general and group, not only the ones below: issues 12
  to 15 visit the lines naming the rules they change (README, Working here 4), and this issue
  checks that none was missed.
- A line that overstates is reworded to what the named rule says. Where the overstatement is
  what a Why needs, the named rule's Statement is the gap: ruled here where it is one ruling,
  else a new rule.

## Problem

- DRV-7's positive half. DRV-7 forbids an early acknowledgement and requires none after
  success. TX-34's Why needs "it has succeeded, and the handler acknowledges" to stop the
  redelivery of a refusal. Lines in TX-15, TX-3, TX-22, TX-31, TX-35, TX-34, TX-21 claim it. All
  four raw readers.
- SVC-2's line on DRV-8, "reaches its system through driving ports": DRV-8 rules imports. Issue
  14 makes DRV-8 say the reach; check the line against what it then says. All four raw readers.
- SVC-4's line on DRV-8, "imports a driving port": permitted, not required (minor).
- TX-6's lines in TX-3, TX-15, TX-22 drop "it makes": TX-6's Scope is a message about a change the
  use case makes; these messages ask for or delegate one. The commit-together guarantee is
  TX-1's.
- A SHOULD stated as given: TX-22's line on TX-31 and TST-6's on TST-4 lack the "by default"
  that SVC-2's on TX-24 and SVC-4's on TST-4 carry.
- SVC-4's line on TX-2 says "a store" where TX-2 binds "its store" (raw Adversarial).
- TX-19's line on TX-32: "one system" against an external system's messages; hangs on the
  glossary's System against the Assumptions (raw Contradiction).
- SYS-10's line on SVC-1: "a system's ports" is wider than "declares" (minor).
- A missing line: SYS-10 leans on SYS-14 (raw Adversarial).
- Lines naming TX-21 use wording older than TX-21's Statement (issue 01's review).

## Decision

—

## Consequences

—
