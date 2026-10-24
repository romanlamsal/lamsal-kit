---
breaches: []
satisfies: [TX-2]
situation: fulfillment saves a Reservation with several lines
---

# Every statement of the save, the loop included, runs on the handed transaction

```ts
// fulfillment/driven/drizzle/reservation-repository.ts
import { asDrizzle } from "@teeladen/common/drizzle"
import type { ReservationRepository } from "../../service/ports"

export const createDrizzleReservationRepository = (db: Db): ReservationRepository => ({
  save: async (reservation, tx) => {
    const conn = tx ? asDrizzle(tx) : db
    const write = async (d: DrizzleConn) => {
      await d
        .insert(reservations)
        .values(toReservationRow(reservation))
        .onConflictDoUpdate({ target: reservations.id, set: toReservationRow(reservation) })
      await d.delete(reservationLines).where(eq(reservationLines.reservationId, reservation.id))
      for (const line of reservation.lines) {
        await d.insert(reservationLines).values(toLineRow(reservation.id, line))
      }
    }
    return tx ? write(conn) : db.transaction(write)
  },
})
```

The adapter narrows the opaque `Transaction` to Drizzle's on its own side and then uses that one
connection for the header row, the delete and every insert in the loop. Nothing in `save` touches `db`
while a transaction was handed over, so a failure anywhere between the statements rolls the whole
Reservation back with the service's other writes, which is what the service handed the transaction
over for.
