---
breaches: [TX-32]
satisfies: [TX-5, TX-6]
situation: billing's dunning stage rises with each reminder and clears once the customer pays; shop keeps a replica for pay-by-invoice
---

# Billing publishes `DunningStageChanged` with the stage alone

```ts
// billing/published/messages.ts
export const dunningStageChangedSchema = z.object({
  id: z.string().uuid(), type: z.literal("DunningStageChanged"),
  customerId: z.string(),
  stage: z.enum(["none", "reminder", "second-reminder", "collection"]),
  changedAt: z.string().datetime(),                 // billing's wall clock
})

// shop/service/record-dunning-stage.ts
export const createRecordDunningStage = ({ transaction, handled, dunning }: Deps): RecordDunningStage =>
  (message) =>
    transaction.run(async (tx) => {
      if (!(await handled.claim(message.id, tx))) return
      await dunning.save({ customerId: message.customerId, stage: message.stage }, tx)   // last one wins
    })
```

The scheduled dunning run raises a customer to `reminder`; a minute later the bank transfer matches and
billing clears the stage to `none`. The relay hands both over; the bus delivers `none` first, then
`reminder`. Shop's replica holds `reminder` for a customer who owes nothing, and checkout refuses them
pay-by-invoice until the next change, which may never come. Shop could compare `changedAt`, but the
dunning run and the bank match run in different processes whose clocks disagree by more than the
minute between them. Nothing on the message says which change came after the other.
