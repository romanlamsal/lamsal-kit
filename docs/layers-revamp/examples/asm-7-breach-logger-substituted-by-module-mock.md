---
breaches: [ASM-7, ASM-2]
satisfies: []
situation: billing's dunning service imports the logger ready-made; its test substitutes it with vi.mock to assert on it
---

# Dunning imports `logger`, and the test mocks the module to read what it logged

```ts
// billing/src/service/run-dunning.ts
import { logger } from "@teeladen/common"

export const createRunDunning = (deps: { tx: TransactionPort; invoices: InvoiceRepository; outbox: BillingOutbox; clock: Clock }): RunDunning =>
  async () => {
    const overdue = await deps.invoices.findOverdue(deps.clock.now())
    for (const invoice of overdue) {
      const advanced = advanceDunning(invoice, deps.clock.now())
      if (advanced.stage === invoice.stage) continue
      logger.info({ invoiceId: invoice.id, from: invoice.stage, to: advanced.stage }, "dunning stage advanced")
      const t = await deps.tx.begin()
      await deps.invoices.save(advanced, t)
      await deps.outbox.write(dunningAdvanced(advanced), t)
      await deps.tx.commit(t)
    }
  }

// billing/test/service/run-dunning.test.ts
vi.mock("@teeladen/common", async (actual) => ({ ...(await actual<typeof import("@teeladen/common")>()), logger: { info: vi.fn(), warn: vi.fn() } }))
const { logger } = await import("@teeladen/common")

it("should log the stage change", async () => {
  // given
  const runDunning = createRunDunning({ tx: fakeTx(), invoices: fakeInvoices([overdueInvoice]), outbox: fakeOutbox(), clock: fixedClock })
  // when
  await runDunning()
  // then
  expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ from: "reminder", to: "warning" }), "dunning stage advanced")
})
```

ASM-7's permission holds for plumbing nobody substitutes. The moment the test needs the logger
silenced or inspected, it is substituted, and the Scope stops holding: this is a dependency that
varies per test, received by nobody. The substitution happens by rewriting a module for the whole
test file, so every other import from `@teeladen/common` in that file, the transaction port
included, now comes from a patched module, and the assertion tests the log line instead of the
saved invoice and the outbox message. A logger the test wants to see is a dependency the service
receives through its factory, and the test hands it a fake; the import stays for the logger nobody
looks at.
