# Reporting reads across systems

**Status:** applied, uncommitted · **Kind:** misleading wording · **Touches:** When to leave it
alone (the reporting-read bullet)

## Context

In `domain.md`, an admin dashboard wants orders, invoices and shipments; all three live in one
Postgres.

## Problem

"A read across aggregates in a repository is a reporting read" lets an agent join billing's and
fulfillment's tables in shop's repository. Transactions, rule 2 already says to read another
system's data through its open host service or a copy.

## Resolution

> A read across its system's aggregates in a repository is a reporting read, not a use case, as
> long as it writes nothing.

## Grounding

Derivation test: rule 2 already decides cross-system reads; the bullet hid it.

## Done when

Approved and committed.
