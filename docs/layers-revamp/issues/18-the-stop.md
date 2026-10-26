# 18 — The stop

**Status:** open

## Context

The full review's Implementers (spec 02) built detours: a replica of billing's dunning stage to
stay inside TX-27, a pool of its own for `/health`, a checkout that orchestrates through the
outbox and drops the `client_secret`, a handler that never acknowledges a refund of an order with
no invoice. None read as deviating; each was the compliant shape its builder found. The README's
Implementer reports a finding where a rule cannot be followed; an agent building a repository has
no such exit and builds the detour. The README does not reach a repository. The distilled output's
preamble does: `distill.mjs` holds it as a constant and drops the input files' openings. Order:
`specs/02-review-findings.md`, step 9.

Settled when it was opened:

- A stop, not a permission. A rule that leaves only a detour is a finding, not a design: the
  agent reports the rule, the detour and its cost, and does not build it. A detour is a compliant
  shape that adds a thing no use case needs, or drops what the caller needs.
- Not "deviate where the properties still hold": the Red team showed the properties as written
  admit the designs the rules exist to refuse (issue 12), and none of the detour builders knew it
  deviated.
- The stop binds the example writers of issue 19 too: their reports are findings.

## Problem

- Where the sentence lives: in the `PREAMBLE` constant of `distill.mjs`, or in a preamble file
  the distiller reads, with `the-world.md`'s opening and the README's "how, and what it keeps, is
  decided when it is first generated" following.
- Its wording, in the preamble's terms: a rule, a Scope that holds, what the compliant shape
  adds or drops, and what the agent does instead.
- To judge a detour, an agent needs to know what the rule protects; nine rules do not say (issue
  13).
- The README's Implementer entry gains the detour as a finding, one line, for the readers that
  run here.

## Decision

—

## Consequences

—
