---
breaches: []
satisfies: [DOM-5, DOM-6]
situation: shop declares the repository for Order and a port for sending mail
---

# Driven ports declared in shop's domain

```ts
// shop/domain/ports/order-repository.ts
import type { Transaction } from "@teeladen/common/transaction"
import type { Order } from "../order"

export interface OrderRepository {
    findById(id: string): Promise<Order | null>
    findPastDeadline(now: Date): Promise<Order[]>
    save(order: Order, tx: Transaction): Promise<void>
}

// shop/domain/ports/mail-sender.ts
import type { OrderConfirmation } from "../order-confirmation"

export interface MailSender {
    sendOrderConfirmation(mail: OrderConfirmation): Promise<void>
}

// shop/adapters/drizzle/order-repository.ts
export const createDrizzleOrderRepository = (db: NodePgDatabase): OrderRepository => ({ /* … */ })

// shop/test/fakes/order-repository.ts
export const createFakeOrderRepository = (seed: Order[] = []): OrderRepository => ({ /* … */ })
```

The domain says what it needs, find orders past their deadline, save an order, send a confirmation, and says nothing of Postgres or the mail provider. The Drizzle adapter and the in-memory fake implement the same declaration, so each depends on the domain and on nothing else of shop. Assembly picks which one the service gets.
