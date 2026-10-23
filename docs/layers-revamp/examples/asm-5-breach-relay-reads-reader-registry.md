---
breaches: [ASM-5]
satisfies: []
situation: the common library's relay reads shop's, payment's and billing's outboxes in the web process
finding: adversarial
---

# The relay imports no system; every system registers its reader into the common library at module load

```ts
// common/src/outbox-registry.ts
const readers: OutboxReader[] = []
export const registerOutboxReader = (reader: OutboxReader): void => { readers.push(reader) }
export const registeredOutboxReaders = (): readonly OutboxReader[] => readers

// common/src/relay.ts  (imports common library only)
import { registeredOutboxReaders } from "./outbox-registry"
export const createRelay = ({ bus }: { bus: Bus }): Relay => ({
    tick: async () => {
        for (const reader of registeredOutboxReaders()) {
            for (const message of await reader.pending()) { await bus.publish(message); await reader.markDelivered(message.id) }
        }
    },
})

// packages/shop/index.ts  (runs when shop is imported, before or after assembly)
import { registerOutboxReader } from "@teeladen/common/outbox-registry"
registerOutboxReader(createDrizzleShopOutboxReader(db))

// apps/web/instrumentation.ts  (assembly)
const relay = createRelay({ bus })             // no readers to hand over; they "register themselves"
```

The relay and the bus import no system, as the Statement requires; their only import is a sibling module of the common library. The Why's harm is intact: the relay knows its readers through a side channel, the worker process that never imports shop's index has a relay that reads nothing from shop's outbox and nobody notices, a reader registered during a test run drains the test's outbox in the next test, and assembly cannot hand the relay fakes because the readers never pass through it. "They MUST import no system and MUST receive the readers and handlers from assembly" is two rulings, so two rules; the second is the one missing, and it is the one the ok example demonstrates.
