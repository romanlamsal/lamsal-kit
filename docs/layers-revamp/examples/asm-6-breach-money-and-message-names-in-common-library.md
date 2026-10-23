---
breaches: [ASM-6]
satisfies: []
situation: Money, Sku and the list of message names put into the common library because every system needs them
---

# `Money`, `Sku` and the message-name enum land in common library

```ts
// common/src/money.ts — "every system needs it, so it goes with the plumbing"
import { z } from "zod"
export const Money = z.object({ amount: z.number().int().nonnegative(), currency: z.literal("EUR") })
export type Money = z.infer<typeof Money>
export const Sku = z.string().regex(/^TEA-\d{5}$/)
export const roundToCent = (m: Money): Money => ({ ...m, amount: Math.round(m.amount) })

// common/src/relay.ts — the envelope knows every message there is, so the relay can type the name
export const MessageName = z.enum(["OrderPlaced", "OrderPaid", "OrderCancelled", "PaymentSucceeded", "PaymentFailed", "InvoiceIssued"])
export const Envelope = z.object({ id: z.string().uuid(), name: MessageName, payload: z.unknown(), occurredAt: z.string().datetime() })
export type Envelope = z.infer<typeof Envelope>

// payment/src/domain/refund.ts — payment's own rule, written against the shared shape
import { Money } from "@teeladen/common"
export const Refund = z.object({ paymentId: z.string(), amount: Money })      // a refund is money going out
```

The shapes in common library are models with no domain behind them. Payment needs CHF for Stripe
and a negative amount for a refund's ledger line; the change is made in common library for
payment's reason, and billing's invoices, whose rules want a non-negative EUR total, recompile
against a `Money` that now allows what billing forbids, with no rule of billing's deciding it.
Fulfillment adding `ShipmentDispatched` edits `MessageName` in common library, and until it does
the relay refuses to deliver fulfillment's own event. A system's shape belongs in its domain; the
shape two systems share belongs to the one upstream of the other, or to a kernel package both opt
into, and the common library in neither case.
