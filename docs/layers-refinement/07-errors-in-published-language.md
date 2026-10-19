# Errors missing from the published language

**Status:** applied, uncommitted · **Kind:** contradiction · **Touches:** Other systems (the open
host service definition, the conformist bullet)

## Context

In `domain.md`, shop conforms to billing; billing's `issueInvoice` can fail with
`OrderAlreadyInvoiced`.

## Problem

The conformist bullet says the other system's "terms, schemas and errors are used as they are";
the open host service definition listed only "the schemas and types those ports take and
return". An agent leaves error types out of the exported entry, and consumers match on strings
or import internals.

## Resolution

> its driving ports, and their *published language* — the schemas, types and errors those ports
> take, return and raise.

## Grounding

Internal consistency. Evans defines a published language as the shared medium for the
information two contexts exchange; failures are part of it *(from memory)*.

## Done when

Approved and committed.
