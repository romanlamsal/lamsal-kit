# Spec 01 — Work order after the provenance pass

A session told "the next in the spec" works the first unchecked step, as a fresh session: the
README, `glossary.md`, `the-world.md` and `general-rules.md` first (README, Working here), then
the step's issue. It checks the step in the commit that lands it.

## Steps

- [x] 1. **Bookkeeping.** Close issue 04 as superseded; open issue 08 for reader round 2.
- [x] 2. **Glossary, issue 06.** External system first, tested against issue 07's Problem list:
  two settled entries lean on it, and step 7 builds on the term instead of reopening it. The
  messaging terms (whose published language holds a command; Message, Saga, Handler, Bus;
  Reconciliation) are step 8's, which changes them under the glossary's tier rules (README,
  Tiers).
- [x] 3. **Apply issue 05.** Its Apply section, in order, on the glossary as step 2 left it.
- [x] 4. **Relies on, issue 09.** First of the open steps: steps 5 to 8 write and revise rules,
  so they write the field and self-review with it, and step 9's readers check it.
- [x] 5. **Transaction reads and concurrency, issue 10.** Before products: steps 7 and 8 build on
  `TX-1` and `SVC-2`, whose guarantees it changes.
- [x] 6. **The world, issue 11.** Before products: it sweeps `general-rules.md` and the README
  for the glossary changes and `the-world.md`, so steps 7 to 9 work against both.
- [x] 7. **Products and external systems, issue 07.** A grill. It decides once the items it shares
  with issue 01: a hook that never arrives with recovery of a message that fails for good; an
  external system that answers only synchronously with a tentative operation left open; the
  idempotency key with NServiceBus's repeat. It may revise general rules between systems.
- [ ] 8. **What is left of issue 01.** Commands, routing to one receiver, the refusal coming back,
  trace context across the bus, the saga gap's remainder; the messaging terms from step 2; the gaps
  issue 09 forwarded.
- [ ] 9. **Readers, issue 08.** Last: steps 5 to 8 revise general rules, and readers run before
  them would read text about to change.
