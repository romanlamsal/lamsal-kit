# 05 — Provenance pass over the general rules

**Status:** open

## Context

Many general rules were carried over from the old document, written while its author's
understanding was partly wrong. A rule resting on a wrong assumption can stand as a MUST. Before
issue 04's decisions, every rule's Statement, within its Scope, is checked against sources outside
this repo: which source states it, which states it differently, which rules against it, and which
rules no source states.

Method:

- Sources: Sources at the end of `general-rules.md`. Khononov and Evans from the author's copies;
  the rest fetched 2026-10-23. Vernon's IDDD was not available, so citations of it are unchecked.
- Six readers, one per cluster: Khononov; Evans; hexagonal and dependency injection; messaging;
  MS and Spring Modulith; testing. Each recorded the passages that support a rule, depart from
  it or contradict it, with the source's own strength. 675 quotes, each found verbatim in its
  source text by script; the heaviest read again in context.
- The verdict per rule is the Provenance rewritten and an `*Audit:*` line, flags defined in the
  rules file's preamble. The reader files hold book quotes at length and are not in the repo.

## Problem

### Tally, 58 rules

- **No flag (11):** `SVC-1`, `DRV-6`, `ASM-1`, `TX-2`, `TX-6`, `TX-12`, `SYS-3`, `SYS-9`,
  `TST-3`, `TST-7`, `TST-8`.
- **Contested (25).** MUST or MUST NOT: `ARR-1`, `DOM-3`, `DOM-4`, `DOM-5`, `SVC-4`, `SVC-5`,
  `ASM-4` (its Why), `ASM-6` (its Why), `ASM-9`, `TX-3`, `TX-4`, `TX-7`, `TX-8`, `TX-10`,
  `TX-17`, `SYS-2`, `SYS-8`, `TST-2`, `TST-4`, `TST-5`. SHOULD or MAY: `ASM-7`, `TX-14`,
  `SYS-5`, `SYS-11`, `TST-9`.
- **Unsourced (17).** The whole ruling: `DOM-6`, `SVC-3`, `ASM-5`, `ASM-8`, `ASM-9`, `TX-11`,
  `TX-16`, `SYS-7`, `SYS-10`. A part: `DOM-1`, `DOM-3`, `SVC-2`, `DRV-1`, `DVN-2`, `ASM-3`,
  `TX-1`, `SYS-1`.
- **Stronger than the sources (8):** `DOM-4`, `DRV-1`, `TX-3`, `TX-5`, `TX-18`, `SYS-7`,
  `TST-2`, `TST-6`. **Weaker:** `TX-15`.
- **Wider than the sources' situation (4):** `ARR-1`, `DOM-1`, `SVC-4`, `DRV-3`. **Narrower:**
  `TX-13`.
- **Citation wrong before this pass (6):** `DRV-3`, `DVN-2`, `ASM-2`, `ASM-3`, `TX-4`, `TX-5`.

### Across rules

1. **One architecture for every system.** Khononov (p. 124, 134, 165), MS and Evans (p. 57) pick
   the architecture per subdomain; for simple logic a transaction script or active record reads
   and writes the store directly. `ARR-1`, `DOM-1`, `SVC-4` and `TST-3` claim any system.
   Decide: general rules for a system with a domain model, and a group file for simple ones, or
   one architecture by choice, stated as such.
2. **The published language apart from the domain.** `SYS-2` against Evans, Khononov, MS,
   NServiceBus and protobuf, the most contested rule. It carries `SYS-5`'s "translating changes
   nothing", `TX-7`'s freeze of re-used domain schemas (Evans p. 264 gives that freeze as the
   reason to keep them apart) and part of `DOM-3`.
3. **One aggregate per transaction.** `TX-14` against Vernon, Khononov, Evans, Fowler and Helland;
   MS alone backs it. It carries `TX-1`'s Scope, `TX-15`'s strength and `SVC-3`'s Why.
4. **Commands name their receiver.** `TX-17` against every messaging source for commands, and
   against the glossary's Orchestration. With the saga gap, to issue 01.
5. **The transaction as an argument.** `DOM-6`, `ASM-9` and `TX-1`'s mechanism have no source;
   MS and Spring pass the transaction by scope.
6. **Locator and ambient values.** Seemann backs injection and rules against ambient context,
   for logging too (`ASM-7`); Fowler and Evans accept a locator or global access (`SVC-5`,
   `ASM-4`). Seemann does not call the framework object's read a service locator (`ASM-4`'s Why)
   and reaches for it only where the framework has no factory seam (`DRV-3`).
7. **Tests.** `TST-2` and `TST-4` are mockist MUSTs; Google, Fowler and Vocke prefer the real
   collaborator while it is fast. `TST-5` against all three for third-party adapters; `TST-9` the
   opposite of Google.
8. **Driven ports in the domain.** `DOM-5` is sourced for repositories only.
9. **A third party through the outbox.** `TX-3` is an option for a third party in the sources, a
   synchronous call their usual alternative. Issue 04's client_secret case sits here.

### Glossary and Assumptions

Found on the way, for a glossary issue of its own:

- *Service* "holds no rule of its own": Evans p. 53 and MS agree; Martin's use cases and
  Fowler's Service Layer hold business rules.
- *Driving port* names one use case: Cockburn and Garrido group several in one port.
- *Fake* has no entry. *Integration test*: Fowler, Vocke and Spring Modulith call tests against
  doubles integration tests; Google SWE rules out the glossary's own example, a real third-party
  API.
- *Open host service*: Evans p. 263 has it pay off with many integrations only; Khononov p. 245
  counts events in the public interface. *Published language*: Evans p. 264 has it documented and
  apart from the host's model.
- *Upstream*, *Downstream*: Evans Reference p. 28 means teams and project success, not code.
- *System*: Khononov p. 41 has each bounded context its own project; Martin's entities serve
  several applications.
- *Message*: NServiceBus has replies as a third kind. *Saga*: Helland 2007 p. 140 reaches
  agreement by tentative operations. *Handler*: in Dahan's design (Vernon EAD II p. 10) the
  class handling the message is the application service.
- *System builder*: Seemann composes as late as possible (ASM-1's Provenance).
- No rule covers: optimistic concurrency (Khononov p. 87, "crucial"), acceptance or end-to-end
  tests (Fowler, Mocks Aren't Stubs: "you must combine"), an acyclic graph of systems (Spring
  Modulith, Verification).

### Next

The author reads the `*Audit:*` lines and decides per rule: keep, saying why the departure is
right; change; or retire. A change to Scope or Statement follows the README's tiers. Then the
Audit lines go and issue 04 is rechecked against the rules as they stand.

## Decision

—

## Consequences

—
