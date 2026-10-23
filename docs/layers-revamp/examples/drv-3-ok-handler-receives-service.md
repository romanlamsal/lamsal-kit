---
breaches: []
satisfies: [DRV-3, ASM-2]
situation: fulfillment's worker handles OrderPlaced; its system builder constructs the handler
---

# Handler takes its service as an argument from the system builder

```ts
// fulfillment/handlers/order-placed.ts  (handler: a driving adapter assembly constructs)
export const createOrderPlacedHandler =
    ({ reserveStock }: { reserveStock: ReserveStock }): Handler<OrderPlaced> =>
    async (msg) => {
        await reserveStock({
            messageId: msg.id,
            orderId: msg.orderId,
            lines: msg.lines.map((l) => ({ sku: l.sku, quantity: l.quantity })),
        })
    }

// fulfillment/build-handlers.ts  (system builder)
export const buildFulfillmentHandlers = (deps: FulfillmentDeps) => {
    const reserveStock = createReserveStock(deps)
    const releaseReservation = createReleaseReservation(deps)
    return {
        orderPlaced: createOrderPlacedHandler({ reserveStock }),
        orderCancelled: createOrderCancelledHandler({ releaseReservation }),
    }
}

// worker/assembly.ts
const handlers = buildFulfillmentHandlers({ stock, reservations, transactions, outbox })
bus.subscribe("OrderPlaced", handlers.orderPlaced)
```

The worker's assembly calls the system builder, which constructs the handler and hands it `reserveStock`. Nothing is imported from assembly, nothing read from a courier; the handler's test calls `createOrderPlacedHandler({ reserveStock: fake })` and asserts what the fake was called with. Port and implementation meet in assembly and nowhere else.
