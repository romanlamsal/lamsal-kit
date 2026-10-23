---
breaches: [ASM-6]
satisfies: [TX-4]
situation: every system's outbox messages share an envelope; fulfillment's deadline release has no acting user
finding: adversarial
---

# A message envelope schema in the common library, belonging to no system

```ts
// common/src/message-envelope.ts  (plumbing for the relay and the bus: nobody's model)
import { z } from "zod"

export const messageEnvelopeSchema = z.object({
    id: z.string().uuid(),
    type: z.string(),
    occurredAt: z.string().datetime(),
    actorId: z.string(),                        // "every message has someone who caused it" (added for billing's audit)
    traceId: z.string().optional(),
    payload: z.unknown(),
})
export type MessageEnvelope = z.infer<typeof messageEnvelopeSchema>

// fulfillment/domain/messages.ts  (fulfillment's outbox port is its own, TX-4)
export const reservationReleasedSchema = messageEnvelopeSchema.extend({
    type: z.literal("ReservationReleased"),
    payload: z.object({ orderId: z.string(), sku: skuSchema, quantity: z.number().int() }),
})

// fulfillment/service/release-expired-reservations.ts  (scheduled task: no user acted)
await outbox.write({ ...released, actorId: "system" }, tx)     // the envelope demands one
```

The envelope is "no schema, no aggregate, no rule of any system": it is the relay's and the bus's, written for no system, so the Statement is satisfied and TX-4 is, since each system declares its own outbox port over it. The Why's harm is the one that lands: a change made for billing's reason, `actorId` required for its audit trail, reaches fulfillment, whose scheduled release has no actor and invents `"system"`, and TX-7 is breached for every system's stored messages at once by a required field no system's domain decided. "It MUST hold no schema that a system's records or messages parse against, whoever declared it" is the wording; "of any system" lets a schema of no system through.
