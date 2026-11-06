Base 83cf6ab, head 4f20cee.
Changed: P5 s1 (observation no longer "only through a courier"), P5 s3 (observation listed beside port implementation, client, configuration value: argument chosen by assembly or courier), glossary Courier bullet 1 (driving adapter nothing can hand it to: framework-constructed or assembly-built before what it calls exists); Why of P5, P6.

## Previous regression

- F-2: unchanged, still resolved. s1's only extra route is still observation; outbox and transaction helpers are untouched by the change.
- Newly broken 1 (logger as factory argument): resolved. s1 no longer limits observation to a courier, s3 now names observation and lets it arrive "as an argument chosen by the process's assembly", and that matches the-world Except ("where the process's assembly chooses what lies behind it"). Reading a has no text left to stand on.
- Noticed 1, P6 no-op default: resolved. The P6 Statement's third sentence already refused a logger courier that throws while unfilled ("its absence MUST change neither"), and the Why now says so too. Neither build has a logger courier.
- Noticed 1, OTel caching: resolved. The P5 Why now says "tracers delegate to the provider assembly registers", which fits `ProxyTracer` caching its delegate. Why only.
- Noticed 2, Courier bullet narrower than s3: resolved. A's `buildShopCmsHooks(shopCourier)` is built in assembly step 2, before shop's services exist (step 3), so it now falls inside "one assembly builds before what it calls exists". No new split: s3 is unchanged on which driving adapter reads a courier.

## Previous builds

Fresh A:
- Payload hooks from `buildShopCmsHooks(shopCourier)`: newly match the Courier glossary entry as well as s3. They complied before too; this only ends the wording drift.
- `pino` to stdout, imported ready-made from `@teashop/common`: unchanged, still breaches s3 (observation is neither an argument chosen by assembly nor read from a courier assembly fills). There are now two fixes: a logger handed in by the builders, or a logger courier with a no-op default (A's `Courier.get()` throws when unfilled, so it cannot be reused as is).
- `@opentelemetry/api` with no SDK, and outbox adapters stamping `trace`: unchanged, comply.

Fresh B:
- `pino` to stdout in `@teashop/telemetry/logger`: unchanged, breaches. The earlier hedge ("unless `startTelemetry` sets the destination") still holds at Statement level, but only if assembly fills a courier the logger reads on each call; stdout itself buys nothing. The argument route is now open too. `createCourier().read()` throws when unfilled, so reusing it for the logger would breach P6 s3 unless given a default.
- Services importing `@opentelemetry/api`, `startTelemetry` in assembly, field hooks reading couriers: unchanged, comply.

## Newly broken

none

## Noticed

- The Statement already refused the Why's stdout case before the change (stdout is the OS, glossary Outside), and by the same text it also refuses `console.*` in services and adapters: a runtime global no assembly fills. This fits the intended "global loggers refused"; flagged only so it is a choice, not a surprise.
- The P4 Why still says "a logger or tracer reached through a courier"; the argument route is now missing there. Why only, no split.
