Base a3c081f, head 83cf6ab.
Changed: P5 s1/s3 (common-library exception becomes observation through a courier read each time it runs), the-world P5 Except, glossary Observation (new), Courier (moved, two bullets), Common library (no layers, judged where run); Why of Assumptions, P1, P2, P4, P5, P6.

## F-2 — resolved

The common library is now code judged as if written where it runs (glossary), so an adapter that runs a common-library outbox or transaction helper reaches its store "as the outside it adapts". P5 s1's only extra route is now observation, which outbox and transaction code plainly is not, so nothing is left to read as forbidding the helper.

- Fresh A: complies. Each system writes its own outbox SQL; `makePgTransactions(db)` in shop's postgres set. A's S5 restriction is no longer demanded, and following it breaches nothing.
- Fresh B: complies. `createPgOutboxAppender` / `createPgTransactions` run inside the adapter position and are handed in by the builder (s3 "as an argument chosen by the process's assembly"). `createPgTransactions` implements `Transactions<PgTx>` with no wrapper module of shop's own; "judged as if written there" covers that.

## Previous builds

Fresh A:
- Outbox/transactions: unchanged, complies.
- `pino` logger to stdout, imported ready-made from `@teashop/common` by services and adapters, which no assembly step configures: newly breaches P5 s1 ("observation, which reaches the outside only through a courier") and s3 (a client built in place; read neither as an argument nor from a courier). Stdout is the OS, so it counts as outside (glossary Outside). The old text allowed it plainly, and its Why endorsed a "ready-made import". This breach is intended: head's Why refuses the sibling cases (`process.env` transport, `getLogger()` taken at module load). Fix: a global the logger module keeps, filled by assembly and read per call.
- `@opentelemetry/api` with no SDK registered: complies. The global provider is a courier nobody fills, and nothing reaches the outside.
- Outbox adapters stamping `trace` from the active span: complies (observation reading the OTel context global per call).
- Payload hook built by `buildShopCmsHooks(shopCourier)`, reading the courier per call: complies with s3 ("a driving adapter ... reads"). See Noticed 2.

Fresh B:
- `createPgOutboxAppender`, `createPgTransactions`, `createPgOutboxReader` built in builders: newly plainly comply (the F-2 split is gone).
- Services importing `@opentelemetry/api` directly (rule `service-reach`): newly complying. This was not "code of the common library" under the old s1; now it is observation through the global provider, which `startTelemetry(config.telemetry)` fills in assembly.
- `pino` to stdout in `@teashop/telemetry/logger`, "the one direct reach": newly breaches P5 s1/s3, as with A. That holds unless `startTelemetry` sets the destination, which the draft does not say. Intended, same fix.
- Stripe SDK / `undici` internals: unchanged, complies. Anything they send goes to the outside the adapter adapts. The same goes for A's `stripe` and 3PL client.

## Newly broken

1. A logger handed in as an argument, typed by the common library (no port).
   - P5 s1: "each also through observation, which reaches the outside only through a courier".
   - P5 s3: "MUST reach code of a system as an argument chosen by the process's assembly, or from a courier that only assembly fills and that a driving adapter, or observation, reads each time it runs".
   - the-world P5 Except: "observation, where the process's assembly chooses what lies behind it".

   Reading a: refused. Observation reaches the outside only through a courier, so an injected logger must become a `Log` driven port in the system's terms.
   Reading b: allowed. Assembly chose it, which is the Except's test, and s3's first branch covers "a client of the outside". It also reads "which reaches ... only through a courier" (set off by commas) as a description. The Why ("Handed through every factory, it adds a parameter ...") names a cost, not a refusal.

   The old text allowed it outright ("code of the common library whose output changes neither ..."). Neither build has it, but it is the Seemann-orthodox shape.
   ```ts
   // payment/adapters/driven/stripe/card-gateway.ts
   export const makeStripeCardGateway = (stripe: Stripe, log: Logger /* @teashop/common */): CardGateway => ({
     refund: async (r) => { log.info({ cardRefundId: r.cardRefundId }, 'refund'); /* ... */ },
   })
   ```

## Noticed

- Tests: P6's last sentence still fits. Observation's courier is filled in a test with an in-memory exporter or with nothing, and by its definition observation meets "its absence MUST change neither". A logger courier must default to a no-op, though: both drafts' couriers throw when unfilled, which fails P6. Also, OTel's `ProxyTracer` caches its delegate once one is registered, so a tracer taken at module load does not truly "read the registered provider on every span" (P5 Why). Swapping per test means one provider per test process plus an exporter reset. Neither draft depends on this.
- Courier's first bullet, "a driving adapter a framework constructs", is narrower than P5 s3 ("a driving adapter") and than P5 Why's assembly-built Payload hook. A's `buildShopCmsHooks(shopCourier)` falls outside the bullets but inside the Statement. Reading the bullets as a closed list leaves that hook no legal route, so this is no split, just wording drift.
- The Common library entry now makes rulings ("holds no business rule", "judged as if written there"), against the glossary's "Definitions only". P3 Scope still names the common library as a place a rule may be stated. The verdict is the same (P3 refuses it, and so does P2 via "judged as if written there"), but there are two routes to it. Nothing says how to judge common-library code that assembly runs (relay, bus); assembly's reading is implied. P1, P11 and P16 are unaffected.
- Observation is defined by its effect on any use case. For the brief's Operations section, both drafts build the checkout trail and the delayed view from records and open hosts, so there is no split. A trace-backed trail (A's D24 alternative) stays observation only while no use case answers from traces. A backoffice use case that queries the tracing backend makes span emission non-observation, so it would need a port. The rule is determinate, but the code's status is decided away from the code (F3).
