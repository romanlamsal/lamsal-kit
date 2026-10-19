# One record written by two systems

**Status:** applied, uncommitted · **Kind:** misleading wording · **Touches:** Terms (*system*)

## Context

In `domain.md`, one Payload `products` document carries copy and images (written by editors, so
catalog's) and price and sku (written by shop's use cases).

## Problem

"An aggregate belongs to the system whose use cases write it" assumes one writer. With two, an
agent picks one owner and lets the other system write through it, or treats the whole document
as shop's and blocks editors.

## Resolution

> An aggregate belongs to the system whose use cases write it, wherever it is stored; a record two
> systems write is two aggregates sharing an id.

## Grounding

Vernon, *IDDD* ch. 10: aggregates refer to each other by identity *(from memory)*. The derivation
test holds: ownership by writer already implies the split; the clause makes it visible.

## Done when

Approved and committed.
