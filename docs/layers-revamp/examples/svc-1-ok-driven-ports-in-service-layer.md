---
breaches: []
satisfies: [SVC-1, SVC-6]
situation: shop declares the repository for Order and a port for sending mail
---

# Driven ports declared in shop's service layer

```ts
// shop/service/ports/order-repository.ts
import type { Transaction } from "@teeladen/common/transaction"
import type { Order } from "../../domain/order"

export interface OrderRepository {
    findById(id: string, tx: Transaction): Promise<Order | null>
    findPastDeadline(now: Date, tx: Transaction): Promise<Order[]>
    save(order: Order, tx: Transaction): Promise<void>
}

// shop/service/ports/mail-sender.ts
import type { OrderConfirmation } from "../../domain/order-confirmation"

export interface MailSender {
    sendOrderConfirmation(mail: OrderConfirmation, idempotencyKey: string): Promise<void>
}

// shop/adapters/drizzle/order-repository.ts
import type { OrderRepository } from "../../service/ports/order-repository"
export const createDrizzleOrderRepository = (db: NodePgDatabase): OrderRepository => ({ /* … */ })

// shop/test/fakes/order-repository.ts
import type { OrderRepository } from "../../src/service/ports/order-repository"
export const createFakeOrderRepository = (seed: Order[] = []): OrderRepository => ({ /* … */ })
```

The services say what they need, find orders past their deadline, save an order, send a
confirmation, in the layer that calls the ports; the domain stays pure and names none of them. The
ports import the domain's types and the common library's opaque transaction, both on SVC-6's list.
The Drizzle adapter and the in-memory fake implement the same declaration, and they and the
services are the ports' only importers: a linter checks that by the path `service/ports`. Assembly
picks which implementation the service gets.
