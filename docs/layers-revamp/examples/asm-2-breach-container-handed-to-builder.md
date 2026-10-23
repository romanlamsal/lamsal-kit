---
breaches: [ASM-2]
satisfies: []
situation: assembly builds shop, which needs billing's and payment's open host services and the Payload catalog
finding: adversarial
---

# Assembly hands the builder a container; the builder picks its dependencies out of it

```ts
// common/src/container.ts
export class Container {
    private readonly built = new Map<string, unknown>()
    register<T>(key: Key<T>, build: () => T): void { this.built.set(key.name, build) }
    get<T>(key: Key<T>): T { return (this.built.get(key.name) as () => T)() }
}

// apps/web/instrumentation.ts  (assembly)
const container = new Container()
container.register(TransactionPortKey, () => createTransactionPort(pool))
container.register(BillingKey, () => buildBilling({ container }).invoicing)
container.register(PaymentKey, () => buildPayment({ container }).payments)
container.register(CatalogKey, () => createPayloadCatalog(payload))
const shop = buildShop({ container })               // every dependency received from the caller

// packages/shop/builders/open-host-service.ts
export const buildShop = ({ container }: { container: Container }): ShopOpenHostService => {
    const tx = container.get(TransactionPortKey)
    const billing = container.get(BillingKey)           // built here, on this call, again in payment's builder
    const payment = container.get(PaymentKey)
    const catalog = container.get(CatalogKey)
    return { placeOrder: createPlaceOrder({ tx, billing, ... }), checkout: createCheckout({ tx, payment, ... }) }
}
```

The builder receives its dependencies from its caller, assembly, in one argument: the Statement is satisfied, and the test hands in a container of fakes. The Why's harm returns anyway: `get` runs the factory on each call, so billing exists once per builder that asks for it and the transaction port once per system, and the graph is not "visible in one place", because what shop depends on is decided inside `buildShop` by which keys it pulls, invisible in assembly's one call. "MUST receive each dependency from its caller, named in its own signature" is the wording that refuses a bag the callee picks from, and `(as () => T)` is the cast the container needs to exist.
