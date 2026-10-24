---
breaches: [TST-4]
satisfies: [TST-6]
situation: shop sends an order-confirmation mail; the default suite tests sendOrderConfirmation
finding: adversarial
---

# The `FakeMailer` is a second adapter, pointed at the provider's sandbox

```ts
// shop/testing/fake-mailer.ts  ("fake: nothing reaches a customer")
import { Resend } from "resend"
import type { Mailer, OutgoingMail } from "../service/ports/mailer"

export class FakeMailer implements Mailer {
    private readonly client = new Resend(process.env.RESEND_SANDBOX_KEY)
    readonly sent: OutgoingMail[] = []

    async send(mail: OutgoingMail): Promise<void> {
        await this.client.emails.send({ ...toProviderMail(mail), to: "delivered@resend.dev" })   // sandbox address
        this.sent.push(mail)
    }
}

// shop/test/service/send-order-confirmation.test.ts  (default suite)
it("should send the confirmation to the customer's address", async () => {
    // given
    const mailer = new FakeMailer()
    const sendOrderConfirmation = createSendOrderConfirmation({ transaction: new FakeTransactionPort(), handled: new FakeHandledMessages(), mailer })
    // when
    await sendOrderConfirmation(sendOrderConfirmationMessage({ email: "tea@example.org", locale: "de" }))
    // then
    expect(mailer.sent[0]?.to).toBe("tea@example.org")
})
```

The test reaches the `Mailer` port through a class named and used as its fake implementation, so the Statement is satisfied; the contract suite even runs against it and the real adapter alike. The Why's harm is what happens on every save: the "fake" needs a network, a key in the environment and a round trip to the provider, so the default suite takes seconds and fails on the train, and from then on it is run less. The glossary has no entry for *fake*, so the Statement rests on the name; "an implementation of the port that reaches nothing outside the process" is the definition that makes the sandbox adapter an integration test's business.
