# Affected set, 8937ad5..042da0f

## Changed blocks

- glossary added: Double
- rule added: DOM-8
- rule added: DOM-9
- rule added: SVC-8
- rule added: ASM-11
- rule added: TX-43
- rule added: TX-41
- rule added: TX-44
- rule added: TX-46
- rule added: TX-42
- rule added: TX-45
- rule added: TX-40
- rule added: SYS-16
- glossary changed: Reach
- glossary changed: Pure
- glossary changed: System builder
- rule changed: DOM-1
- rule changed: DOM-7 (Why, Relies on, Provenance or Examples only)
- rule changed: SVC-6 (Why, Relies on, Provenance or Examples only)
- rule changed: SVC-2
- rule changed: SVC-7 (Why, Relies on, Provenance or Examples only)
- rule changed: DRV-8 (Why, Relies on, Provenance or Examples only)
- rule changed: DRV-7
- rule changed: ASM-3
- rule changed: ASM-4
- rule changed: ASM-8 (Why, Relies on, Provenance or Examples only)
- rule changed: TX-1 (Why, Relies on, Provenance or Examples only)
- rule changed: TX-23
- rule changed: TX-37
- rule changed: TX-30
- rule changed: TX-35
- rule changed: TX-19
- rule changed: TX-7
- rule changed: TX-17
- rule changed: TX-34
- rule changed: TX-38
- rule changed: TX-12
- rule changed: TX-27
- rule changed: SYS-14

## Term Double, used by

  - rules TST-10 l.1936, 1940, 1942
  - rules TST-4 l.1968
  - rules TST-5 l.1975, 1978, 1980, 1986
  - rules TST-6 l.2007
  - rules TST-11 l.2050

## Term Reach, used by

  - world (preamble) l.15
  - world P4 l.81
  - rules DOM-1 l.55, 59, 60, 61, 76
  - rules SVC-6 l.230
  - rules SVC-7 l.358
  - rules DRV-8 l.415
  - rules DRV-7 l.514
  - rules ASM-7 l.670
  - rules ASM-5 l.783
  - rules TX-30 l.1252
  - rules TX-5 l.1364
  - rules TX-42 l.1476
  - rules TX-12 l.1627, 1639
  - rules SYS-1 l.1730
  - rules SYS-9 l.1766, 1773
  - rules SYS-10 l.1787
  - rules SYS-2 l.1801
  - rules SYS-16 l.1882
  - rules TST-8 l.2016

## Term Pure, used by

  - rules DOM-1 l.47, 52, 54, 56, 68
  - rules SVC-1 l.201
  - rules SVC-6 l.222
  - rules DRV-8 l.406, 423, 432
  - rules DVN-4 l.530, 544
  - rules SYS-14 l.1850, 1867
  - rules TST-3 l.1922, 1923
  - rules TST-10 l.1939, 1940

## Term System builder, used by

  - rules ASM-1 l.565, 574
  - rules ASM-2 l.586
  - rules ASM-11 l.640, 644
  - rules ASM-8 l.755

## Rule DOM-8

Relies-on lines naming it: none
Examples naming it: none

## Rule DOM-9

Relies-on lines naming it: none
Examples naming it: none

## Rule SVC-8

Relies-on lines naming it: none
Examples naming it: none

## Rule ASM-11

Relies-on lines naming it: none
Examples naming it: none

## Rule TX-43

Relies-on lines naming it: none
Examples naming it: none

## Rule TX-41

Relies-on lines naming it: none
Examples naming it: none

## Rule TX-44

Relies-on lines naming it: none
Examples naming it: none

## Rule TX-46

Relies-on lines naming it: none
Examples naming it: none

## Rule TX-42

Relies-on lines naming it: none
Examples naming it: none

## Rule TX-45

Relies-on lines naming it:
  - TX-34 l.1551: TX-45: a use case called for a message whose change another system refuses commits the refusal as
Examples naming it: none

## Rule TX-40

Relies-on lines naming it: none
Examples naming it: none

## Rule SYS-16

Relies-on lines naming it: none
Examples naming it: none

## Rule DOM-1

Relies-on lines naming it:
  - TST-3 l.1921: DOM-1: the domain reaches nothing but a shared kernel, the published language of an upstream its
  - TST-10 l.1938: DOM-1: the domain reaches nothing but a shared kernel, the published language of an upstream its
Examples naming it:
  - examples/dom-1-breach-domain-imports-common-tracing-module.md
  - examples/dom-1-breach-order-id-from-node-crypto.md
  - examples/dom-1-breach-order-number-hash-from-node-crypto.md
  - examples/dom-1-breach-order-type-from-drizzle-table.md
  - examples/dom-1-ok-order-schema-imports.md
  - examples/svc-6-ok-opaque-transaction.md
  - examples/sys-14-breach-money-imports-common-logger.md
  - examples/sys-14-ok-money-returns-remainder.md
Other rules whose Examples line names one of those files: SYS-14

## Rule DOM-7 (Why, Relies on, Provenance or Examples only)

Relies-on lines naming it:
  - DOM-9 l.175: DOM-7: a business rule of this system is stated once, in the domain.
  - SYS-16 l.1881: DOM-7: a business rule of this system is stated once, in the domain.
Examples naming it: none

## Rule SVC-6 (Why, Relies on, Provenance or Examples only)

Relies-on lines naming it:
  - SYS-2 l.1805: SVC-6: what the service layer reaches includes its system's domain and its published language.
Examples naming it:
  - examples/asm-9-ok-transaction-handed-as-argument.md
  - examples/svc-1-ok-driven-ports-in-service-layer.md
  - examples/svc-4-breach-mark-paid-updates-column.md
  - examples/svc-4-breach-second-repository-patches-order-status.md
  - examples/svc-6-breach-drizzle-transaction-in-port.md
  - examples/svc-6-ok-opaque-transaction.md
  - examples/svc-6-ok-place-order-dependencies.md
  - examples/svc-7-breach-service-queries-handed-drizzle-client.md

## Rule SVC-2

Relies-on lines naming it:
  - DRV-1 l.445: SVC-2: the service that acts enforces a decision by stored state itself, in the call that acts.
Examples naming it:
  - examples/drv-8-breach-adapter-reads-repository-to-check-owner.md
  - examples/svc-2-breach-loaded-order-passed-through-port.md
  - examples/svc-2-breach-server-action-checks-before-cancel.md
  - examples/svc-2-ok-cancel-order-decides-itself.md

## Rule SVC-7 (Why, Relies on, Provenance or Examples only)

Relies-on lines naming it:
  - ASM-7 l.666: SVC-7: a service or a driving adapter reaches the outside through a port of its system.
Examples naming it:
  - examples/dvn-4-ok-payload-adapter-imports-external-package.md
  - examples/svc-6-breach-drizzle-transaction-in-port.md
  - examples/svc-7-breach-server-action-raw-sql-through-common-pool.md
  - examples/svc-7-breach-service-queries-handed-drizzle-client.md
  - examples/svc-7-ok-order-overview-through-query-port.md
  - examples/svc-7-ok-payment-reaches-stripe-through-gateway-port.md

## Rule DRV-8 (Why, Relies on, Provenance or Examples only)

Relies-on lines naming it:
  - SVC-2 l.275: DRV-8: a driving adapter reaches no driven port, driven adapter or service of its system.
  - SVC-4 l.321: DRV-8: a driving adapter reaches a driving port of its system, and no repository.
Examples naming it:
  - examples/drv-1-breach-callback-in-acting-call.md
  - examples/drv-1-ok-session-through-answering-service.md
  - examples/drv-8-breach-adapter-reads-repository-to-check-owner.md
  - examples/drv-8-breach-mailer-subscribed-to-bus-in-assembly.md
  - examples/drv-8-breach-server-action-updates-order-table.md
  - examples/svc-6-ok-place-order-dependencies.md
  - examples/svc-7-breach-server-action-raw-sql-through-common-pool.md
Other rules whose Examples line names one of those files: SVC-7

## Rule DRV-7

Relies-on lines naming it:
  - TX-15 l.985: DRV-7: a handler acknowledges a message once the use case it calls has succeeded, not before.
  - TX-3 l.1007: DRV-7: a handler acknowledges a message once the use case it calls has succeeded, not before.
  - TX-22 l.1039: DRV-7: a handler acknowledges a message once the use case it calls has succeeded, not before.
  - TX-31 l.1129: DRV-7: a handler acknowledges a message once the use case it calls has succeeded, not before.
  - TX-35 l.1273: DRV-7: a handler acknowledges a message once the use case it calls has succeeded, not before.
  - TX-21 l.1336: DRV-7: a handler acknowledges a message once the use case it calls has succeeded, not before.
  - TX-34 l.1545: DRV-7: a handler acknowledges a message once the use case it calls has succeeded, not before.
  - TX-38 l.1578: DRV-7: a handler does not acknowledge a message unless the use case it calls has succeeded.
  - TX-45 l.1605: DRV-7: a handler acknowledges a message once the use case it calls has returned with what it
Examples naming it:
  - examples/tx-34-breach-refund-refusal-thrown.md
  - examples/tx-35-breach-late-payment-dropped.md
Other rules whose Examples line names one of those files: TX-34, TX-35

## Rule ASM-3

Relies-on lines naming it: none
Examples naming it:
  - examples/asm-3-breach-current-user-from-request-context.md
  - examples/asm-3-breach-current-user-getter-through-factory.md
  - examples/asm-3-breach-locale-read-from-request-context.md
  - examples/asm-3-breach-repository-scopes-rows-by-ambient-customer.md
  - examples/asm-3-breach-service-reads-request-user.md
  - examples/asm-3-ok-actor-through-driving-port.md
  - examples/asm-3-ok-confirmation-message-carries-locale.md
  - examples/asm-3-ok-hook-passes-editor.md
  - examples/asm-3-ok-trace-context-crosses-bus-in-envelope.md
  - examples/drv-1-ok-session-through-answering-service.md
  - examples/svc-2-ok-cancel-order-decides-itself.md
  - examples/tx-22-ok-order-confirmation-mail-through-outbox.md

## Rule ASM-4

Relies-on lines naming it:
  - ASM-8 l.749: ASM-4: what reads the courier is a driving adapter assembly cannot construct, or cannot hand what
Examples naming it:
  - examples/asm-3-ok-actor-through-driving-port.md
  - examples/asm-4-breach-driven-adapter-reads-courier.md
  - examples/asm-4-ok-route-handler-reads-courier.md
  - examples/asm-8-breach-courier-filled-with-lazy-factory.md
  - examples/drv-3-ok-server-action-reads-courier.md
  - examples/drv-6-breach-courier-read-memoized-on-first-run.md
  - examples/sys-1-ok-shop-hooks-via-builder.md

## Rule ASM-8 (Why, Relies on, Provenance or Examples only)

Relies-on lines naming it:
  - DRV-3 l.472: ASM-8: assembly fills the courier before any driving adapter reads it.
Examples naming it:
  - examples/asm-1-breach-one-assembly-run-twice.md
  - examples/asm-2-ok-assembly-hands-upstreams-to-builder.md
  - examples/asm-8-breach-courier-filled-with-lazy-factory.md
  - examples/asm-8-breach-route-fills-courier-lazily.md
  - examples/asm-8-ok-register-fills-courier-before-requests.md

## Rule TX-1 (Why, Relies on, Provenance or Examples only)

Relies-on lines naming it:
  - SVC-2 l.267: TX-1: a use case that writes runs in one transaction its service opens, hands to each call it
  - SVC-3 l.297: TX-1: a use case that writes runs in one transaction its own service opens and commits.
  - DRV-1 l.446: TX-1: a use case that writes runs in one transaction its service opens and commits.
  - DRV-7 l.511: TX-1: a use case that writes runs in one transaction its service opens and commits.
  - TX-2 l.859: TX-1: a use case that writes runs in one transaction, which its service hands to each call it
  - TX-23 l.879: TX-1: a use case that writes runs in one transaction, which its service hands to each call it
  - TX-24 l.912: TX-1: a use case that writes runs in one transaction, which its service hands to each call it
  - TX-25 l.939: TX-1: a use case that writes runs in one transaction its own service opens and commits.
  - TX-15 l.980: TX-1: a use case that writes runs in one transaction, which its service hands to each call it
  - TX-37 l.1069: TX-1: a use case that writes runs in one transaction, which its service hands to each call it
  - TX-28 l.1176: TX-1: a use case that writes runs in one transaction its own service opens and commits.
  - TX-6 l.1301: TX-1: a use case that writes runs in one transaction, which its service hands to each call it
  - TX-5 l.1358: TX-1: a use case that writes runs in one transaction, which its service hands to each call it
  - TX-34 l.1547: TX-1: a use case that writes runs in one transaction, which its service opens, hands to each call
  - TX-38 l.1577: TX-1: a use case that writes runs in one transaction its service opens and commits.
Examples naming it:
  - examples/asm-9-ok-transaction-handed-as-argument.md
  - examples/drv-1-breach-invoice-batch-in-one-transaction.md
  - examples/svc-3-breach-place-order-calls-clear-cart.md
  - examples/svc-3-ok-place-order-writes-cart-itself.md
  - examples/svc-4-ok-mark-paid-through-repository.md
  - examples/svc-6-ok-place-order-dependencies.md
  - examples/svc-7-ok-order-overview-through-query-port.md
  - examples/tx-1-breach-cart-cleared-after-order-committed.md
  - examples/tx-1-breach-order-saved-without-transaction.md
  - examples/tx-1-breach-repository-reads-ambient-unit-of-work.md
  - examples/tx-1-ok-one-invoice-transaction-per-message.md
  - examples/tx-1-ok-place-order-service-holds-transaction.md
  - examples/tx-1-ok-refund-and-payment-in-one-transaction.md
  - examples/tx-22-breach-claim-rolled-back-after-3pl-call.md
  - examples/tx-22-ok-payment-requests-checkout-session.md
  - examples/tx-3-ok-checkout-requests-checkout-session.md
  - examples/tx-34-breach-refund-refusal-thrown.md
  - examples/tx-34-ok-refund-refusal-published.md
  - examples/tx-5-ok-fulfillment-claims-message-id-and-records-early-cancel.md
Other rules whose Examples line names one of those files: TX-34

## Rule TX-23

Relies-on lines naming it:
  - SVC-2 l.271: TX-23: a repository's save of an aggregate loaded through it fails where the aggregate has
  - SVC-4 l.323: TX-23: a repository's save of an aggregate loaded through it fails where the aggregate has
  - TX-24 l.910: TX-23: a repository's save of an aggregate loaded through it fails where the aggregate has
Examples naming it: none

## Rule TX-37

Relies-on lines naming it:
  - TX-22 l.1040: TX-37: the use case called for the message makes the change without deciding again whether to
  - TX-45 l.1601: TX-37: a use case called for a message that asks for a change its transaction does not commit
Examples naming it: none

## Rule TX-30

Relies-on lines naming it:
  - TX-36 l.1105: TX-30: a business rule of this system decides what happens when a confirmation or an answer
  - TX-28 l.1177: TX-30: a business rule of this system decides what happens when a confirmation does not come.
  - TX-44 l.1227: TX-30: a business rule of this system decides what happens when a confirmation does not come, so
Examples naming it:
  - examples/tx-28-ok-after-change-hook-records-revalidation-request.md
  - examples/tx-30-breach-payment-pending-until-webhook.md
  - examples/tx-30-ok-payment-asks-stripe-at-deadline.md
Other rules whose Examples line names one of those files: TX-29

## Rule TX-35

Relies-on lines naming it:
  - TX-37 l.1073: TX-35: a business rule of the system decides what follows when an event tells it its part of
Examples naming it:
  - examples/sys-13-ok-checkout-process-sends-receivers-commands.md
  - examples/tx-35-breach-late-payment-dropped.md
  - examples/tx-35-ok-late-payment-refunded.md

## Rule TX-19

Relies-on lines naming it:
  - TX-46 l.1384: TX-19: a use case called for a delivered message leaves the records of what the message tells of
Examples naming it:
  - examples/tx-19-breach-not-found-read-as-already-released.md
  - examples/tx-32-breach-dunning-stage-changed-without-version.md
  - examples/tx-32-ok-dunning-stage-changed-carries-version.md
  - examples/tx-5-ok-fulfillment-claims-message-id-and-records-early-cancel.md
Other rules whose Examples line names one of those files: TX-32

## Rule TX-7

Relies-on lines naming it:
  - TX-42 l.1474: TX-7: a changed schema of a message keeps what old code writes readable by new code and the
  - TX-12 l.1629: TX-7: a changed schema of a message, or of an open host service called from another process,
  - SYS-2 l.1803: TX-7: a changed schema of a message, or of an open host service called from another process,
Examples naming it:
  - examples/tx-7-breach-amount-unit-changed-in-place.md
  - examples/tx-7-breach-customer-id-renamed-quantity-narrowed.md
  - examples/tx-7-ok-gift-message-added-optional.md

## Rule TX-17

Relies-on lines naming it:
  - TX-26 l.1662: TX-17: a system that publishes an event names no system that handles it.
Examples naming it:
  - examples/tx-17-breach-order-placed-addressed-to-fulfillment.md
  - examples/tx-17-ok-fulfillment-subscribes-to-order-placed.md
  - examples/tx-33-ok-billing-handles-payment-refunded.md

## Rule TX-34

Relies-on lines naming it: none
Examples naming it:
  - examples/tx-34-breach-refund-refusal-thrown.md
  - examples/tx-34-ok-refund-refusal-published.md

## Rule TX-38

Relies-on lines naming it:
  - TX-34 l.1549: TX-38: a use case called for a message that is stopped by no business rule of its system and by
  - TX-45 l.1603: TX-38: a use case called for a message stopped by no business rule and by no refusal of another
Examples naming it: none

## Rule TX-12

Relies-on lines naming it:
  - TX-40 l.1703: TX-12: a use case reads data another system owns from the owner's open host service or from its
Examples naming it:
  - examples/asm-2-ok-shop-reads-invoice-through-driven-port.md
  - examples/sys-1-breach-shop-exports-order-repository.md
  - examples/sys-9-breach-dashboard-imports-drizzle-tables.md
  - examples/tx-12-breach-order-detail-joins-invoices-table.md
  - examples/tx-12-breach-query-port-on-billing-open-host-service.md
  - examples/tx-12-breach-replica-refreshed-from-fulfillment-tables.md
  - examples/tx-12-ok-invoice-number-through-billing-port.md
  - examples/tx-12-ok-shipment-status-replica-from-fulfillment-messages.md

## Rule TX-27

Relies-on lines naming it:
  - TX-40 l.1707: TX-27: a use case that decides by another system's data decides as a business rule of its system
Examples naming it: none

## Rule SYS-14

Relies-on lines naming it:
  - DOM-1 l.52: SYS-14: a published language or a shared kernel reaches nothing but a shared kernel and pure
Examples naming it:
  - examples/sys-14-breach-money-imports-common-logger.md
  - examples/sys-14-ok-money-returns-remainder.md

