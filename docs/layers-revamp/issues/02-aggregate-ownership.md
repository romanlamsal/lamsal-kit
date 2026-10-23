# 02 — Aggregate ownership by rules, not by writers

**Status:** closed

## Context

The glossary defined an aggregate as belonging to "the system whose use cases write it". The
Transactions rules need the situation "a use case of this system changes data another system
owns", and the Other systems rules need "one record that two systems write".

## Problem

Under the old definition, the first situation cannot occur: whatever a system's use case writes is,
by definition, its own. A rule with that Scope governs nothing, and the breach it exists for, a
system writing a field whose meaning another system decides, is not a breach.

## Decision

Aggregate ownership is by rules: "It belongs to the system whose rules decide what it holds,
wherever it is stored." A use case writing a field another system's rules decide now changes data
another system owns.

Worked in the same session as the port of `general-rules.md`, not in a fresh one as the README
prescribes, because the port is what surfaced it and the sweep of the lower tier is the port
itself.

## Consequences

- `TX-3` (change data another system owns) has a Scope that occurs.
- `SYS-8` (one record, fields decided by two systems) follows from the definition instead of
  restating it.
- A copy of another system's data (`TX-13`) is this system's aggregate: this system's rules decide
  what the copy holds, the owner's messages update it.
