---
breaches: []
satisfies: [ASM-5, ASM-6, ASM-2]
situation: common library relay in the fulfillment worker, reading shop's and fulfillment's outboxes
---

# The relay takes outbox readers and a bus; it knows no system

```ts
// common/src/relay.ts
export type Envelope = { id: string; name: string; payload: unknown; occurredAt: string }
export type OutboxReader = {
  next(limit: number): Promise<readonly Envelope[]>
  markDelivered(ids: readonly string[]): Promise<void>
}
export type Bus = { publish(message: Envelope): Promise<void> }

export const createRelay = (deps: { readers: readonly OutboxReader[]; bus: Bus; batchSize?: number }) => ({
  async tick() {
    for (const reader of deps.readers) {
      const batch = await reader.next(deps.batchSize ?? 100)
      for (const message of batch) await deps.bus.publish(message)
      await reader.markDelivered(batch.map((m) => m.id))
    }
  },
})

// apps/fulfillment-worker/main.ts — assembly hands the relay what to read
const relay = createRelay({ readers: [shop.outboxReader, fulfillment.outboxReader], bus })
```

The relay's imports are its own: an envelope of id, name, opaque payload and time, the reader
interface each system implements over its own outbox, and the bus interface. Shop's `OrderPlaced`
schema never enters common library; the relay forwards `payload` as `unknown` and the handler in
the receiving system parses it. Adding billing's outbox to a process is one more element in the
`readers` array in that process's assembly, and the relay module is untouched.
