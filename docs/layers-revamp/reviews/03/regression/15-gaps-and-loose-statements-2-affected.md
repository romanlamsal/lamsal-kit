# Affected set, 042da0f..28801e5

## Changed blocks

- rule added: TX-47
- rule changed: SVC-2
- rule changed: SVC-8
- rule changed: TX-1 (Why, Relies on, Provenance or Examples only)
- rule changed: TX-7

## Rule TX-47

Relies-on lines naming it:
  - TX-1 l.821: TX-47: a service opens, commits and rolls back a transaction through a driven port of its
Examples naming it: none

## Rule SVC-2

Relies-on lines naming it:
  - DRV-1 l.442: SVC-2: the service that acts enforces a decision by stored state itself, in the call that acts.
Examples naming it:
  - examples/drv-8-breach-adapter-reads-repository-to-check-owner.md
  - examples/svc-2-breach-loaded-order-passed-through-port.md
  - examples/svc-2-breach-server-action-checks-before-cancel.md
  - examples/svc-2-ok-cancel-order-decides-itself.md

## Rule SVC-8

Relies-on lines naming it: none
Examples naming it: none

## Rule TX-1 (Why, Relies on, Provenance or Examples only)

Relies-on lines naming it:
  - SVC-2 l.266: TX-1: a use case that writes runs in one transaction its service opens, hands to each call it
  - SVC-3 l.294: TX-1: a use case that writes runs in one transaction its own service opens and commits.
  - DRV-1 l.443: TX-1: a use case that writes runs in one transaction its service opens and commits.
  - DRV-7 l.508: TX-1: a use case that writes runs in one transaction its service opens and commits.
  - TX-2 l.880: TX-1: a use case that writes runs in one transaction, which its service hands to each call it
  - TX-23 l.900: TX-1: a use case that writes runs in one transaction, which its service hands to each call it
  - TX-24 l.933: TX-1: a use case that writes runs in one transaction, which its service hands to each call it
  - TX-25 l.960: TX-1: a use case that writes runs in one transaction its own service opens and commits.
  - TX-15 l.1001: TX-1: a use case that writes runs in one transaction, which its service hands to each call it
  - TX-37 l.1090: TX-1: a use case that writes runs in one transaction, which its service hands to each call it
  - TX-28 l.1197: TX-1: a use case that writes runs in one transaction its own service opens and commits.
  - TX-6 l.1322: TX-1: a use case that writes runs in one transaction, which its service hands to each call it
  - TX-5 l.1379: TX-1: a use case that writes runs in one transaction, which its service hands to each call it
  - TX-34 l.1569: TX-1: a use case that writes runs in one transaction, which its service opens, hands to each call
  - TX-38 l.1599: TX-1: a use case that writes runs in one transaction its service opens and commits.
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
Other rules whose Examples line names one of those files: TX-47, TX-34

## Rule TX-7

Relies-on lines naming it:
  - TX-42 l.1496: TX-7: a changed schema of a message keeps what old code writes readable by new code and the
  - TX-12 l.1651: TX-7: a changed schema of a message, or of an open host service called from another process,
  - SYS-2 l.1825: TX-7: a changed schema of a message, or of an open host service called from another process,
Examples naming it:
  - examples/tx-7-breach-amount-unit-changed-in-place.md
  - examples/tx-7-breach-customer-id-renamed-quantity-narrowed.md
  - examples/tx-7-ok-gift-message-added-optional.md

