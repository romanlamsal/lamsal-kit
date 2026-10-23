---
breaches: [ASM-5, ASM-6, ASM-2]
satisfies: []
situation: common library relay imports shop's and fulfillment's outbox readers and shop's OrderPlaced schema
---

# The relay imports the readers it reads and validates shop's event on the way out

```ts
// common/src/relay.ts
import { shopOutboxReader } from "@teeladen/shop/outbox"
import { fulfillmentOutboxReader } from "@teeladen/fulfillment/outbox"
import { OrderPlaced } from "@teeladen/shop/language"
import type { Bus } from "./bus"

const readers = [shopOutboxReader, fulfillmentOutboxReader]      // every outbox there is, in one list

export async function tick(bus: Bus) {
  for (const reader of readers) {
    const batch = await reader.next(100)
    for (const message of batch) {
      if (message.name === "OrderPlaced") OrderPlaced.parse(message.payload)   // catch a bad event before it is published
      await bus.publish(message)
    }
    await reader.markDelivered(batch.map((m) => m.id))
  }
}
```

Common library now depends on two systems: every process that imports the logger loads shop's and
fulfillment's outbox modules, the web server's bundle included, and billing getting an outbox means
editing the relay. The readers are imported ready-made, so the relay reads whatever store those
modules connected to, not what the process's assembly built, and the fulfillment worker, which
should relay fulfillment's outbox alone, relays shop's as well from a second process. `OrderPlaced`
inside the relay is a model in the common library: a field shop adds to its event is now a change
with a reviewer from the common library, and the relay rejects messages written before the deploy
that the new schema no longer parses.
