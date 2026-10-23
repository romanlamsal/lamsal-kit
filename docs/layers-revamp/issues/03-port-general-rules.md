# 03 — Port general-rules.md to the rule shape

**Status:** closed

## Context

`general-rules.md` was in the pass-1 shape: statement, *Why*, *Looks like*, *Allowed*,
procedures, "by default". The README fixed the new shape: Scope, Statement with one modal, Why,
Provenance from outside sources, Examples. The old file was renamed, a fresh one started, and each
rule ported on its own.

## Problem

Rules with several rulings, carve-outs inline, and ids whose ruling another rule or the glossary
already carries.

## Decision

Forty-two rules, each one ruling. Where the old rule had several, the first keeps the id and the
rest get new ids; where another rule or the glossary carries the ruling, the id retires.

- Retired: `ARR-2`, `ARR-3` (both legs ruled by `ARR-1`), `DVN-1` (glossary plus `DOM-5`),
  `TST-1` (glossary: Integration test).
- Split: `TX-3` into `TX-3`, `TX-11`, `TX-12`, `TX-13`, `TX-14`, `TX-15`; `TX-1` and `TX-10`;
  `TX-4` and `TX-16`; `TX-8` and `TX-17`; `ASM-3` into `ASM-3`, `ASM-8`, `ASM-9`, `TX-18`;
  `SYS-1` into `SYS-1`, `SYS-9`, `SYS-10`; `SYS-5` and `SYS-11`; `DRV-3` and `DRV-6`; `TST-2`
  and `TST-8`.
- Carve-outs that became MAY rules: plumbing instance (`ASM-7`), caller identity through a driven
  port (`DRV-5`), copy of another system's data (`TX-13`), outbox between own aggregates
  (`TX-15`).
- Carve-outs that became SHOULD: own fake per downstream (`TST-9`); conformist (`SYS-5`) and
  anti-corruption layer (`SYS-11`) each got a Scope that excludes the other.
- Moved: `SVC-1`'s "constructs nothing" to `ASM-2`; `DOM-5`'s "no driving port in the domain"
  to `SVC-1`; `TST-4`'s assertion style to `TST-7`; `SYS-1`'s "a downstream's system builder"
  clause dropped, `ASM-2` forbids it.
- Deferred to issue 01: delivery semantics (old `ASM-5`, `TX-5`).
- Dropped: "which values a codebase holds ambient, it says in an ADR" (old `ASM-3`); the
  README's deviation mechanism covers it.

## Consequences

- Every rule has `*Examples:* —`. The examples session fills them; the old *Allowed* and *Looks
  like* texts are the first candidates:
  - ok: a read across aggregates in a driven adapter that writes nothing (`ARR-1`); a service that
    does nothing but call its repository (`SVC-4`); a message carrying its aggregate's version so
    a handler ignores a staler one (`TX-5`); another system catching up a moment later (`SYS-7`);
    the upstream's terms used directly under conformist (`SYS-5`); one module holding the
    translation for both adapters (`SYS-11`).
  - breach: a populated relationship (`DOM-4`); a driving adapter needing two service calls
    (`DRV-1`); a loop with one write per iteration (`TX-2`); a handler treating "not found" as
    "already handled" (`TX-5`); a message schema without an id (`TX-5`).
- Strengths assigned without examples: `SHOULD` on `TX-14`, `SYS-5`, `SYS-11`, `TST-3`, `TST-7`,
  `TST-9`; everything else `MUST` or `MAY`. The readers test these.
- Known fixture collisions, to be placed by the readers: the common library's ambient unit of
  work (`ASM-9`); the shared kernel's `Money` and `Sku` (`ASM-6`); shop writing price on
  Payload's document (`SYS-8`, `TX-3`).
