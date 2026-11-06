# 22 — Review 04 choices findings

**Status:** open

## Context

Review 04 (`reviews/04/checklist.md`, R04-41 to R04-43). `choices.md` changes once the rule set is
settled, together with the fixture (issue 21).

## Problem

- R04-41: C2 choreography, C8 PaymentIntent before the commit, C9 payments its own system, 3 of 3
  each where the entry says designs may differ. No rule closed them; the fixture fixes them for
  this shop: C8 by "Checkout must return a Stripe `client_secret` in the same request" (`domain.md`
  l.38), C9 by the system table, C2 by the saga written as choreography. Proposal: all three stay
  open.
- R04-42: C4 split two to one. The Whys' contradiction (R04-12) is gone since d54c665 (P2: the
  system whose rule vetoes owns the record); both designs hold, so C4 stays open.
- R04-43: stock at checkout, no synchronous hold in any draft (review 03: 4 of 4 held). Lands on
  C6, call now or go by messages, so no finding. Proposal: name stock at checkout in C6's
  Situation.
- From issue 21, R04-39: a new entry for the dashboard, a composing system over replicas or
  per-system pages.
