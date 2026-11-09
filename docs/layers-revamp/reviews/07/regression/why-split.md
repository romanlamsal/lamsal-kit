Base 81fb8fd, head 6745deb.
Changed: every property's and rule's Why and Provenance moved out of layers.md into layers-why.md; binding text checked identical to the parent aaab4ac (glossary, world, Except, Against, Scope, Statement, Assumptions, Conventions); rules preamble rewritten; pointer added.

## Every rule

- P1: holds alone
- P2: needs its Why: a service test that doubles a domain module (`vi.mock` of `payment-options`) is refused only by the Why's "a double of a domain module is the rule copied into the test"; to a reader of file 1 alone, "MUST NOT state it again" plausibly covers no stub, and the Conventions' SHOULD covers only tests of the rule itself.
- P3: holds alone
- P4: needs its Why: the sender a customer sees, read from a configuration value by the mail adapter, reads in file 1 either as changing "how a use case acts" or as configuration choosing what lies behind a port; only the Why puts it on the refused side.
- P5: holds alone (a driven adapter importing another adapter is a port's implementation reaching code of a system other than as an argument, so the third sentence refuses it)
- P6: holds alone
- P7: holds alone
- P8: needs its Why: a hook that answers 200 and then calls its use case. File 1's acknowledgement clause reads as the outbox, bus, handler chain; per glossary Bus, "delivered" means the bus. Only the Why makes the hook a handler whose answer is the acknowledgement.
- P9: holds alone
- P10: holds alone
- P11: holds alone
- P12: holds alone
- P13: holds alone
- P14: holds alone
- P15: holds alone
- P16: holds alone
- P17: holds alone
- P18: needs its Why: ordering one thing's messages by the writer's timestamp passes as "by what the message carries"; only the Why says a time on the message is the writing process's clock, so it is not the order of writing.
- P19: holds alone

## Builds

Fresh A:
- S17 changes. A took "sender in domain" citing P4's Why. In file 1, P2's "every value it decides by" reaches no sender that no business rule decides, so B (configuration) is as likely.
- P2 paragraph, "tests call real domain functions and never double them": leaned on P2's Why. A reader of file 1 may double the domain in service tests.
- P8 paragraph, "Hooks answer 200 only after the use case returned": leaned on P8's Why. Answering first is as likely.
- Envelope, `occurredAt` "never used for ordering", and P18: leaned on P18's Why. A reader of file 1 may keep the later `occurredAt` (e.g. for `billing`'s standing).
- S7 likely same: glossary Replica ("lags the owner") supports B without the Why's example.
- S2, S8, S9 quote text the parent no longer has (outbox port's definite article, P17 "if" list, P6's transaction-port fake), so the split does not bear on them (see Noticed).

Fresh B:
- P2 paragraph, "Service tests use the real domain, never a double of it": same as A.
- Stripe hook, "answers 200 only after it returns": same as A.
- P18 paragraph, the per-thing version counter: the counter is described only in the Why. Without it, a reader of file 1 may carry a timestamp instead.
- S2 same; the P2 Why sentence that made the tension is gone, and the glossary entry External system gives (a).
- S5 and S6 same: each pick holds under the Statements alone.
- S3 and S9 quote text the parent no longer has (Transaction port "returns the transaction", Assumptions "Which one is the architecture's").

## Pointer

Clear on where (`layers-why.md`, `## P<n>.`, same folder; `docs/agents/` ships whole) and when ("a decision contests a rule, or a Statement reads two ways"). It catches readings the agent sees as two. It misses the four above: in each, the agent of file 1 reads one way and is sure of it (stub = no statement, sender = deployment config, hook ack ≠ bus ack, timestamp = write order), so nothing contests and nothing reads two ways to them. The trigger depends on noticing doubt, and these are cases where no doubt arises.

## Newly broken

```md
---
breaches: [P2]
satisfies: [P6]
situation: shop's checkout service test stubs the domain's payment-options rule
finding: regression
---
```
```ts
// packages/shop/test/services/checkout.test.ts
vi.mock('../../src/domain/payment-options', () => ({ paymentOptions: () => ['card', 'invoice'] }));
it('should place an invoice order', async () => { /* service on fakes for every driven port */ });
```

```md
---
breaches: [P4]
satisfies: [P5]
situation: the customer-visible sender comes from configuration, handed in by assembly
finding: regression
---
```
```ts
// packages/shop/src/adapters/driven/mail/mail-sender.ts
export const createMailSender = (cfg: { apiKey: string; from: string }): MailSender => ({
  send: (m) => client.send({ from: cfg.from, to: m.to, subject: m.subject, html: m.html }),
});
// apps/web/src/config.ts: MAIL_FROM="Teehaus <bestellung@teehaus.de>"
```

```md
---
breaches: [P8]
satisfies: [P4, P5, P9]
situation: Stripe hook answers before its use case runs; a stop in between loses the event
finding: regression
---
```
```ts
// packages/payment/src/adapters/driving/next/stripe-hook.ts
export async function POST(req: Request): Promise<Response> {
  const event = stripe.webhooks.constructEvent(await req.text(), sig(req), secret);
  void readPaymentPorts().recordStripeNotice({ messageId: `stripe:${event.id}`, subject: toSubject(event) });
  return new Response(null, { status: 200 });
}
```

```md
---
breaches: [P18]
satisfies: [P9, P10]
situation: billing runs two worker replicas with skewed clocks; shop keeps the dunning flag with the later occurredAt
finding: regression
---
```
```ts
// packages/shop/src/services/record-customer-dunning.ts
const current = await replica.get(tx, m.email);
if (current && current.billingOccurredAt >= m.occurredAt) return; // older by billing's clock
await replica.save(tx, { email: m.email, inDunning: m.inDunning, billingOccurredAt: m.occurredAt });
```

## Noticed

- distilled.md is not the split's parent: aaab4ac already changed the outbox port's article, dropped Transaction port's "returns the transaction" and Assumptions' "Which one is the architecture's", dropped P7's outbox MUST sentence and P17's "if" list, and changed P18's fetch clause. The brief's "rules text identical" is wrong.
- P15's Why says a driving adapter that depends on another system before its call is P5's to deliver; P5's Statement does not refuse it.
- P19's Why cites "the third sentence"; P19's Statement has two. P8's Why counts sentences with a different split than its Statement.
