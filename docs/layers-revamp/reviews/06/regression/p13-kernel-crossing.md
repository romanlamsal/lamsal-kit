Base e5da5fa, head 611be78.
Changed: P13 s1 drops "a shared kernel" from what another system may import of an offer; P13 s2 drops "or of a shared kernel both share"; P12 s2 "nor a shared kernel any system's" becomes "nor any shared kernel". P13 Why, Provenance and the appendix reworded. Glossary and the world are unchanged.

## F-1 — resolved

The kernel route is gone from P13 s1 and s2, and P12 s2 now plainly forbids a published language to reach any kernel. The glossary already makes every open host service port type and every message part of the published language, so nothing that crosses or sits on an offer can be typed by the kernel. All three now say the same.

- Fresh A: complies. `published-closed` allows only `zod` and sibling modules. The V1 open host service types and the messages use plain cents and strings. `Money` appears only in the system's own ports.
- Fresh B: breaches P12 s2, because `published-closed` lets published modules import `@teashop/kernel` ("may import only `zod`, the kernel and its own published modules"). Any published schema or open host service type that uses the kernel's `Money` or `EmailAddress` also breaches P13 s1, since the offer would hold an item typed by the kernel. The one open host service type B shows complies: `OpenCardPaymentV1 = { orderRef: string; amountCents: number; customerEmail: string }`. Fix: take the kernel out of `published-closed`.

## Previous builds

Fresh A:
- S15: reading A is now the only reading. The build does not change.
- P12 s2: complies ("no published language reaches another's or the kernel").
- S11: the sentence it quotes lost "a shared kernel". The reading it picked, builders on the offer for assembly, is untouched.
- Nothing newly breaches. Nothing newly complies, since A already took the strict reading.

Fresh B:
- P12 s2: newly breaches, through `published-closed` admitting the kernel.
- P13 s1 and s2: newly breaches wherever a published message or open host service type passes the kernel's `Money` between sharers (`RefundCardPayment` from shop or billing to payment, `CardRefunded` and `DisputeLost` back). B does not show those field types. The visible open host service types comply.
- B's rule "the kernel no system" was its reading of the garbled base clause (no kernel reaches any system's published language). P12 s2 no longer says this, but P1's closed list still enforces it. The rule is extra, not a breach.
- S12 (P3: the kernel's zod schemas): the diff does not touch it. With the kernel off published languages, `Money`'s schema serves domains only. Still complies.
- backoffice, which shares no kernel: if a published language it imports reached the kernel, backoffice reached the kernel through the offer. This goes away once `published-closed` is fixed.

## Newly broken

None. Checked:
- Fake on the offer: it is typed by the open host service port, which is published language. A fake's body may use the kernel, but a fake is not a module that declares a published language, and its type is not the kernel's.
- Builders: only assembly imports them, which is no system. They were outside P13 s1 before the change and still are (the appendix still flags this).
- Conformist: takes the upstream's published language, which is now free of the kernel. A conformist that also shares a kernel holds both the kernel's `Money` and the upstream's cents. P19 s2 makes it name them apart, as before.
- Sharer importing the kernel: the kernel is part of its own domain (glossary: Shared kernel), so this is no import of another system. A system that shares no kernel could not import it before the change either, since the kernel was never on any offer.
- Statements of P1, P2, P3, P5, P11 and P19, and the glossary entries Shared kernel, Offer and Published language: none lets a kernel type cross between systems or sit on an offer.

## Noticed

- The base P12 s2 garble had a second reading, B's: no kernel reaches any system's published language. The head drops it. P1 (closed list, reach counted through what a listed module reaches) and P12 s1 still refuse it for every sharer that does not conform to that upstream. The corner where every sharer conforms is coupling they chose. P12's Why example (a kernel importing billing's `Currency`) now argues a case the Statement no longer names.
- P1's Why still speaks of what a kernel may reach "for its other importers, a downstream's adapter". A downstream that shares no kernel cannot import it (P13 s1). Leftover wording; it binds nobody.
- The head Why has sharers restate `Money` in the published language's own terms (cents and a currency). P13's MAY covers this as long as the kernel counts as "the domain", and the glossary says it does (part of the domain model). So there is no P2 breach and no split.
- In P13's Statement, s2 and s3 now run on one overlong source line. Cosmetic only.
