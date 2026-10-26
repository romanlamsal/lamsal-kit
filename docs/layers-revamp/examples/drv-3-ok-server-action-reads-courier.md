---
breaches: []
satisfies: [DRV-3, DRV-6, ASM-4]
situation: Next.js finds and calls shop's server action; assembly never constructs it
---

# Server action reads its service from the courier

```ts
// common/courier.ts  (common library, per-process courier)
const registry = new Map<string, unknown>()
export const provide = <T>(key: CourierKey<T>, value: T): void => { registry.set(key.name, value) }
export const resolve = <T>(key: CourierKey<T>): T => {
    const value = registry.get(key.name)
    if (value === undefined) throw new Error(`courier empty for ${key.name}`)
    return value as T
}

// shop/courier-key.ts
export const shopServicesKey = courierKey<ShopOpenHostService>("shop.services")
export const shopServices = (): ShopOpenHostService => resolve(shopServicesKey)

// app/assembly.ts  (filled before any request, via instrumentation hook)
provide(shopServicesKey, buildShopOpenHostService({ db, payload, transactions }))

// app/checkout/actions.ts  (driving adapter the framework constructs)
export async function placeOrderAction(form: FormData) {
    const { placeOrder } = shopServices()
    return placeOrder({ ...placeOrderInputSchema.parse(Object.fromEntries(form)), placedAt: new Date() })
}
```

Next.js discovers `actions.ts` and calls `placeOrderAction` itself; no caller exists to hand it a service. So the action reaches what assembly produced through the courier, read when it runs. Assembly remains the one place where `PlaceOrder` meets `createPlaceOrder`, and the action's test fills the courier with a fake before calling it (TST-4). The `as T` narrows an `unknown` the registry holds under a typed key; no `any`.
