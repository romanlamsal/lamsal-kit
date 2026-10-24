---
breaches: [SVC-1]
satisfies: []
situation: fulfillment declares its port to the 3PL warehouse where the first adapter is
---

# Warehouse port declared in the 3PL adapter module

```ts
// fulfillment/adapters/threepl/client.ts
import { ThreePlSdk, type ThreePlShipmentRequest } from "@acme/threepl-sdk"
import type { Shipment } from "../../domain/shipment"

export interface WarehousePort {
    requestShipment(shipment: Shipment): Promise<{ trackingId: string }>
}

export const createThreePlWarehouse = (sdk: ThreePlSdk): WarehousePort => ({
    requestShipment: async (shipment) => {
        const res = await sdk.shipments.create(toThreePlRequest(shipment))
        return { trackingId: res.tracking_number }
    },
})

// fulfillment/service/ship-order.ts
import type { WarehousePort } from "../adapters/threepl/client"

// fulfillment/test/fakes/warehouse.ts
import type { WarehousePort } from "../../adapters/threepl/client"
```

The interface is written where its first implementation is, which is where the developer is when the need appears. Now the service and the fake both import the adapter module, and with it the 3PL SDK; the fake's test loads the SDK to fake it away. Declared in fulfillment's service layer, the port is imported by the service that calls it and the two adapters that implement it, and nothing of the SDK comes along.
