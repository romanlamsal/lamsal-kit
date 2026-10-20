# Layers

Where server code goes and what it is allowed to touch.

**Preconditions.** The repository layer assumes a store that can be read and written. Store
clients are one store where one transaction port makes their writes atomic together; two clients
of one database are two stores until one port reaches both, which is each codebase's choice. Where
this document says *transaction*, it assumes the store can apply several writes atomically; where
one cannot, question 5 ("Did one transaction quietly become several?") does not apply to it, and an
aggregate's outgoing messages are embedded in its own record. *Table*, *row* and *aggregate* are
used in the relational sense — substitute your store's equivalents.

**Terms.** A *controller* is a driving adapter: it resolves the caller (a session, a signature, a
key), validates, calls into one thing, and returns. It takes its rules from the domain.
`components.md` applies the same role to route files on the client; the difference is writes — a
server controller passes a write through to one service, a route controller does not carry writes
at all.

A *port* is an interface, never the code behind it. A *driving port* is the interface to a use
case — the way in, something a controller calls. A *driven port* is something the code needs from
outside — the way out: store an aggregate, send a mail, put a file somewhere. Who starts the call
decides which: the outside starts it, driving; this system starts it, driven. An *adapter* sits on
the far side of a port: a *driving adapter* calls a driving port, a *driven adapter* implements a
driven port. Controllers are driving adapters; repositories and infrastructure are driven
adapters. This is ports and adapters as Vernon joins it to DDD; where this document narrows a
term, the narrowing applies.

A *system* is one bounded context: code with its own domain and its own glossary, laid out by
this document. A repository may hold several. Another bounded context is another system, even
when it is imported in-process as a package; so is a product (Products). An aggregate belongs to
the system whose use cases write it, wherever it is stored; a record two systems write is two
aggregates sharing an id.

A *common library* is plumbing every system may import: the transaction port, store clients, a
logger, a tracer, the outbox relay. It holds no model.

This document is written for review. The faults below are the ones a linter cannot see, because
they are about what a function *does* rather than where it imports from.

## The layers

| layer | what it is | may import | does |
| --- | --- | --- | --- |
| **domain** | pure rules, and the driven ports those rules need. No I/O | other domain modules, the common library's ports, and pure libraries — validation, date and money arithmetic | computes from its arguments, and runs on any runtime (below) |
| **repository** | adapters for this system's aggregates, wherever they are stored. One aggregate each, composes nothing | the store client, the common library, the domain | serves one aggregate; joins the caller's transaction |
| **service** | use cases. **The only entry for doing something.** Receives what it needs | domain, driving ports of other services in this system, and the open host service of a system it conforms to | receives its dependencies; writes through repositories |
| **infrastructure** | adapters for other systems: mail, rendering, third-party APIs, auth, a system behind an anti-corruption layer | domain, the common library, and the open host service of a system it translates | translates between this system's ports and the other system |
| **controllers** | driving adapters: entry points, their validators | services, domain, and infrastructure that resolves or translates its caller | reaches the store only through a service |

The arrow runs one way — controller → service → repository → store — and the domain sits beside
all of it: every layer may import it, it imports no layer. Repository and infrastructure are both
driven-adapter layers; they differ only in subject matter, one implementing ports for this
system's aggregates and the other for somebody else's.

**"Imports no layer" is about this system's modules, not about packages.** The test for a package
in the domain is whether calling it can reach outside the process: a store client, an HTTP client,
a mailer SDK, `node:fs` and a clock all can, so they stay behind ports. A validation library
cannot — it computes from its arguments and returns — so it is allowed, and so is any other
library of the same shape. Runtime validation is not an exception carved out for one package; it
falls out of the test.

**The domain runs on any runtime.** It uses what every runtime has: the language and pure
libraries. `node:*` modules and a runtime's globals — `Buffer`, `process`, `window`, the DOM —
belong to the layers that run on one runtime, even where they cannot reach out of the process:
`node:path` is pure, and still breaks in a browser. This holds through imports: a common-library
module that imports `node:async_hooks` brings the runtime with it. Running on any runtime is what
lets a browser and another system import the domain, and importing it loads only the domain.

A schema is a rule, not a description of one. `Invoice` — which fields exist, that an amount is a
positive integer, that a status is one of four — is the same statement as the functions beside it,
written in a form that also holds at runtime. Types are inferred from it.
Putting it in the domain is what keeps a single constructor (question 3) possible: the controller
validating input and the repository mapping a row parse against the same schema instead of two
drifting copies of it.

**An aggregate refers to another aggregate, and to another system's data, by id.** What it needs
of the other at the time — a price, a title — it copies as its own value. A reference that loads
the other's whole record, such as a populated relationship, carries the other's model into this
aggregate.

In the vocabulary of domain-driven design, **domain** is the model, **service** is the
application layer, **infrastructure** and **repository** are both infrastructure, and
**controllers** are the interface layer.

**A driving adapter acts through one service and asks through the domain.** To act, it calls one
service function; needing two is the signal that a use case has grown inside it. To answer a
question about a rule — may this caller do this, is this input valid — it calls a
*specification*: a domain function that takes the candidate and returns the answer. When the
answer needs data the adapter does not hold, a service of its system loads the data and asks the
specification. Where its caller delivers at least once — a relay, a webhook, a product's hook —
handling the same delivery twice changes nothing the second time, however late the second comes.

## Ports and factories

**Driven ports live in the domain.** The rules declare what they need — store this order, send
this mail — and adapters in the repository and infrastructure layers implement it. The domain
names ports only; assembly picks their implementations.

**Driving ports live beside the service that satisfies them.** A use case is not a domain
concept, so the domain never learns the name of one. This is what keeps the arrow pointing in one
direction.

**A service is a factory.** It takes its dependencies as arguments and returns its driving port.
Nothing inside it constructs anything.

```
// service/order.ts
export const createOrderService = (deps: {
  orders: OrderRepository        // driven port, from the domain
  invoices: InvoiceRepository    // driven port, from the domain
  mailer: Mailer                 // driven port, from the domain
  tx: TransactionRunner          // driven port, from the common library
}): OrderService => ({ ... })    // driving port, declared here
```

**Assembly is not a layer.** One module per process builds the adapters, calls the factories, and
hands the result to the controllers. It is the only place that knows both a port and its
implementation. Keep it separate from the factories: a service module exports only its factory,
and assembly holds the instances, so every dependency is one a factory declared.

**Atomicity crosses ports through a transaction port.** The service asks to run something inside
a transaction; repository methods take the context it hands back. The context is opaque in the
domain, so nothing there names the store or its client.

```
// service: two aggregates, one transaction
await tx.run(async (ctx) => {
  await orders.markSettled(ctx, orderId)
  await invoices.clearDunning(ctx, orderId)
})
```

**A value that influences nothing a use case or domain function decides may be held ambient** —
Fowler's registry, scoped per request: a request id, a trace context, the locale a mail is
rendered in, the user an audit column records until a rule decides by it. The transaction context
is not one: what a read returns depends on it. Say which values are held ambient; the line is this
document's choice.

## Other systems

**A system offers an open host service: its driving ports and its *published language* — the
schemas, types and errors those ports take, return and raise, and the messages the system
publishes, if any.** Its driven ports stay inside; they are its needs, not its offer. Export:

- the published language, for other systems to import;
- the driving port types, for other systems to import;
- a function that takes configuration and builds the open host service, for another system's
  assembly to call;
- where it exports one, a fake of its driving ports, for other systems' tests, from an entry
  production does not load;
- where it handles messages, a function that takes configuration and builds its message handler,
  for the assembly that hands it to the relay. Whether one function builds both is each codebase's
  choice.

Give the published language and the port types an entry that loads only the domain, so another
system imports them without loading any service. Other systems reach a system only through these
exports, which a linter can hold from import paths alone.

```
// pricing's entries — file names are the codebase's
// published language and port types: loads only the domain
export type { Pricing } from "./service/pricing.port"
export { Quote, PriceList, PriceListChanged } from "./domain/quote"

// builds the open host service: for another system's assembly
export const createPricing = (config: PricingConfig): Pricing => ...
```

**The published language is the domain's own schemas, by default.** A separate language is
allowed where the domain must change without breaking other systems; record the reason in an ADR.
Khononov keeps the two apart from the start; re-exporting the domain is this document's choice.

**One system's driving port is the other's driven port.** To B, `Pricing` is the way in; to
A's service it is a dependency it receives — a way out, like a mailer. A service calling it is not
one use case calling another; it is a use case calling a port. What sits behind the port is
assembly's decision: B's service in-process, or an HTTP client in A's infrastructure implementing
the same port. Moving B out of process changes assembly and nothing else.

**A driving port another system calls takes its caller as an argument.** A consumer reaches B's
service without passing B's controllers, so whatever those controllers resolve — who is calling,
on whose behalf — cannot come from them, and B's authorization lives in its service or domain.

**How two systems relate is chosen per relationship, in the terms of DDD's context map.** Three
choices decide where code goes:

- **Conformist.** This system adopts the other's published language: its terms, schemas and
  errors are used as they are, in any layer that may import a domain, and its driving port is a
  driven port a service receives like any other. The default for an open host — a system that
  publishes its model on purpose.
- **Anti-corruption layer.** This system's domain declares a driven port in its own terms; an
  adapter in infrastructure implements it by calling the other system's driving port and
  translating. For a model that is foreign, unstable or not yours — a third-party API always gets
  one. On the way in — a webhook, a product's hook, a message — the driving adapter that receives
  the other system's call translates it into this system's terms before it calls a service. The
  other system's schema and the translation live in that adapter, or in infrastructure shared with
  the outbound adapter; never in the domain.
- **Shared kernel.** Model two systems share, such as `Money`, goes in a module both import and
  neither changes alone.

The other context-map patterns describe how teams cooperate; in code, each lands as one of these
three, or as no integration at all.

**The consuming system's assembly builds the other system, by default; escalate when that stops
being true.** A's assembly calls the function B exports to build its open host service, and nothing else of A
learns how B is built.
Move that call up into a composition root that wires both systems once, when:

- a second consuming system would build B again, and B holds something that must exist once — a
  cache, a pool, a subscription;
- B needs systems of its own, and A would end up assembling B's upstreams;
- two systems would assemble each other — a cycle in the context map, which usually means a
  boundary is drawn wrong. A product that calls back is the exception (Products).

Until one of these holds, a root is ceremony.

### Products

**A product with a model of its own — a CMS, an auth library — is another system**, even when its
tables sit in this system's database.

- **Where this system stores an aggregate in a product, the product's screens may read it.** A
  change made there is an action — a button, an endpoint — whose driving adapter calls this
  system's service.
- **A product's hooks and scheduled tasks are driving adapters**, and the constraints on driving
  adapters apply to them. For a hook, answer in order:
  - **The product's caller is this system** → this system started the call, so it is not a
    driving one: the hook does nothing, and the use case that called the product handles the
    change. How the hook recognises this system as the caller is each codebase's choice.
  - **It asks**, such as whether a change is valid → it asks, at any point.
  - **It acts** → answer in order:
    1. **The product has committed the change** → the hook acts through one service.
    2. **The product's caller needs this system's work before the product answers it**, such as a
       profile for a user signing up → the hook acts now, through one service, in this system's
       own transaction. If the product rolls back, the saga or reconciliation undoes the work. A
       hook the product runs after its commit does the same with nothing to undo, and is preferred
       where the product offers one.
    3. **The hook runs inside the product's transaction, and a write there commits and rolls
       back with the change** (the product hands the hook its transaction, and the outbox is in a
       store that transaction reaches) → the hook writes only a message there, to this system's
       outbox or the product's, as each codebase chooses. Nothing is lost.
    4. **Otherwise**, inside the transaction or before it opens → the hook leaves its work to a
       handler that first checks the change through the product.

  Steps 2 and 3 are this document's choice; the sources do not cover a product's transaction. A
  hand-off, or an act after the commit, is lost when the process stops first and the product
  does not run the hook again; reconciliation repairs it.
- **A product that calls back is a cycle by design.** Its config needs the hooks, the hooks need
  services, the services need adapters over the product's instance, and the instance needs the
  config. Assembly breaks it by late binding: an adapter receives a function that returns the
  instance, and calls it only when it does work.

## Transactions

**Writes that must land together share one transaction, and the transaction stays inside its
system**, except a message a product's hook writes in the product's transaction (Products). For
each piece of data the use case touches, answer in order:

1. **Does it change data another system owns — a third party's included, such as a mail sent or
   a payment created?** → **Outbox, required.** Write a message to this system's outbox in the
   same transaction; a system writing several stores has an outbox in each it sends from. The
   owner changes its data when the message arrives.

   Where the use case's caller waits for the other system's answer, call the other system
   instead, once the transaction has committed, and record the answer, if this system keeps it,
   in a transaction of its own. Make the call safe to repeat: the other system recognises a
   repeat however it can — a key it dedupes on, this system's id stored on its side and looked
   up first. Where it cannot, a repeat may duplicate. A failure after the commit, and a
   duplicate, are repaired by the saga or by reconciliation. This exception is this document's
   choice; the sources do not cover it.
2. **Does it read data another system owns?** → **Call the owner's open host service.** If it
   offers no fitting read, keep a copy in this system, updated by the owner's messages. In this
   case, the owner publishes.
3. **Does it write several aggregates of this system?** → **One transaction, by default.** This is
   this document's choice; Vernon and Khononov keep one aggregate per transaction. An outbox is
   also valid here, and required where no one transaction reaches them all, as for aggregates in
   different stores. Good tells for one:
   - the aggregates are often written at the same time, and one transaction would block or
     conflict;
   - the rule between them may hold a moment later.
4. **Otherwise** → one transaction.

**An outbox, wherever it is used:**

- A relay delivers each message after the commit, at least once, and not necessarily in order —
  possibly to a handler older or newer than the code that wrote it, so a message's schema stays
  backward and forward compatible.
- The relay is common-library plumbing. The receiver decides which messages it handles.
- The receiver handles it in its own transaction, through a driving adapter that calls one
  service. Handling the same message twice changes nothing the second time.
- When a later step fails, new steps undo the earlier ones — a saga, here the whole sequence
  rather than Khononov's coordinating component. Nothing rolls back. A step that waits on
  something that may never happen, such as a payment never made, has one system waiting for it:
  that system holds the deadline in its aggregate and acts once it passes. How the systems
  coordinate is each codebase's choice: each reacts to the others' events (choreography), or one
  system's process manager sends commands (orchestration). Say which.

## The review checklist

Nine questions, each answerable from a diff. The snippets are illustrative pseudo-code.

### 1. Does a service write a table another aggregate owns?

**In a diff:** an insert, update or delete inside a service, or a service reaching for a store
handle, against a table the file is not named after.

The write belongs to the repository that owns the table. The service hands that repository its
transaction context and keeps the deciding.

```
// service/order.ts — the fault
ctx.insert(invoices).values({ orderId, total })

// the fix: one call into the owning repository
invoices.createForOrder(ctx, { orderId, total })
```

### 2. Is the new use case in a repository, or in a controller?

**In a diff:** a repository module that gained an import of a sibling repository, of an
infrastructure adapter, or of a service. Or a controller body that grew past "call one service".

A controller that hands a repository a transaction and a callback has not delegated a use case,
it has inlined one: the deciding still happens in the controller.

```
// controller — the fault
await tx.run(async (ctx) => { /* seven writes, four aggregates */ })

// the fix
await orderService.acceptQuote(orderId)
```

### 3. Does this add a second constructor for the same row?

**In a diff:** a row shape for one table built in two places — commonly once on the server and
once in a client-side optimistic update, or in two services.

Two constructors drift, and the drift stays invisible until two parts of the system disagree
about a rule neither of them writes down. Decide the rule once in the domain and have both
spread it.

```
// domain/invoice.ts — settling also clears dunning, decided once
export const settledPatch = (at) => ({ status: "settled", settledAt: at, dunningStage: 0 })
```

### 4. Does the write invalidate every aggregate its service wrote?

**In a diff:** a write declaring one invalidation while the service it calls writes two tables.

Open the service and count the tables it touches — **including the ones reached through a
transaction context it handed to another aggregate's repository**. Every aggregate written needs
to be named. The write the screen is obviously about is the easy half; the one further down the
shared transaction is the half that gets missed.

```
// settleOrder writes `orders` and clears `invoices.dunning_stage`
// declared: ["order"]            — the fault
// declared: ["order", "invoice"] — correct
```

`components.md` is the client-side form of this question.

### 5. Did one transaction quietly become several?

**In a diff:** a function that opens its own transaction instead of joining the one it was
given; a repository method that takes the context and writes without it; a loop that calls a write
per item.

Moving a write out of a function tends to give it its own transaction. A repository method joins
the caller's transaction and opens nothing. Writes that must land together run inside one `run`; a
loop that calls `run` per item is one transaction per item, and a failure halfway leaves the use
case half-applied.

```
// the fault
for (const line of lines) await tx.run((ctx) => orderLines.insert(ctx, line))

// the fix
await tx.run((ctx) => orderLines.insertMany(ctx, lines))
```

### 6. Does a repository import a service?

**In a diff:** a service import inside a repository file.

The first two faults seen from the other end, and the cheapest to spot. It means a use case is
parked in a repository.

### 7. Does anything build its own dependency instead of receiving it?

**In a diff:** a concrete adapter imported into a service file, or constructed inside a service
body or a factory body, rather than passed in. Also: a module exporting a ready-made instance
next to the factory that produces it.

This one is invisible to the other six — the code sits in the right layer and imports nothing the
arrow forbids. What it breaks is substitution: the service can no longer be given a different
implementation, so its tests need the real one. Plumbing with one fixed configuration, such as a
logger or a tracer, may be a ready-made instance: nobody substitutes it.

```
// service/order.ts — the fault
const orders = createPostgresOrderRepository(db)

// the fix: it arrives as an argument, and assembly decides which one
export const createOrderService = ({ orders }: { orders: OrderRepository }) => ...
```

### 8. Does the boundary match the relationship?

**In a diff:** a driven port whose types copy another system's field for field, and an adapter
mapping each field to itself. Or a message schema copied field for field from the system that
publishes it. Or, behind an anti-corruption layer, one of the other system's terms in this domain
or a service.

A translation that changes nothing is not an anti-corruption layer; conform instead. A term that
crosses an anti-corruption layer untranslated means there is no layer.

```
// infrastructure/pricing.ts — the fault: a translation that changes nothing
quote: async (cart) => {
  const { total, currency } = await pricing.quote(cart)
  return { total, currency }
}

// the fix: conform, and the service receives the pricing system's driving port
export const createOrderService = ({ pricing }: { pricing: Pricing }) => ...
```

### 9. Does a message schema change break a message in flight?

**In a diff:** a field renamed, removed, made required, or narrowed in the schema of a message —
including a domain schema the published language re-exports.

A message written before the deploy is handled after it, and a handler on older code may read one
written after. The type checker sees neither: the stored row is not in the program.

```
// domain/order.ts — OrderPaid, the fault
- total: Money
+ amount: Money   // an OrderPaid still in the outbox has no amount
```

## Tests

One section, deliberately self-contained.

**An integration test is one that uses a real external dependency** — a database, a broker, a
third-party API. Everything else is not, whatever it covers.

**The default suite runs on fakes.** It must be fast enough that nobody thinks
about running it. Where a real dependency would appear, a fake implementation of the port appears
instead.

**Test the domain directly.** It is pure, it holds the rules, and it needs no fixtures, no fakes
and no setup. Most of what is worth asserting lives here.

**Test services and driving adapters against fakes.** Each receives ports, so a test hands it
fakes and asserts what it *did*: which port it called, with what, and what it returned. Assert
observable behaviour, not the order of internal calls.

**Driven adapters are integration-tested by design.** A driven adapter's entire job is to talk to
something external, so a unit test of one asserts a mock of the thing it exists to reach. Unit
tests pay off there only for genuinely self-contained pieces — a query builder's output, a mapping
function.

**Keep the fakes honest with contract tests.** Write one suite per driven port, against the port
rather than any implementation, and run it twice: against the fake, and against the real adapter.
For another system's driving port, the receiving system writes the suite, whether the fake is its
own or one the other system exports, and runs it the second time against that system's open host
service. The second run is the integration test, and it is what stops a fake from drifting into
a fiction that passes while production breaks.

```
// one suite, two runs
describeContract("OrderRepository", () => createFakeOrderRepository())
describeContract("OrderRepository", () => createPostgresOrderRepository(testDb))
```

Make switching between them a flag rather than an edit: the fast run is the default, and the real
one is what you reach for when a failure makes you doubt the fake.

**What makes a good test here** is that it survives a rewrite of the thing it tests. It names
inputs and observable results.

## When to leave it alone

- **A service that only forwards to its repository is correct here**, not an unnecessary
  indirection. A controller's only door is a service, even when the service exports the same name
  again, so that deleting a repository fails inside the service that names it rather than at a
  controller naming a symbol.
- **A read across its system's aggregates in a repository is a reporting read, not a use case**,
  as long as it writes nothing.
- **A service passing its transaction context into another repository of its system is the design
  working.** That is how several tables stay one transaction.
- **A use case touching three aggregates and naming three invalidations is correct**, not a
  breach of one mutation per use case.
- **A port with one implementation is not premature.** The second implementation is the fake, and
  it is what the default suite runs against.
- **Several systems each faking the same port can be correct.** By default, each system writes its
  own fake. One fake that the providing system exports fits only where its consumers need the same
  things of it; a fake that needs configuration per consumer has outgrown that.
- **Using a conformed system's terms directly is the design working**, not a leak.
- **A service calling another system's driving port is calling a port**, not a use case nested in
  another.
- **A system's assembly building another system itself is correct** until one of the reasons to
  escalate holds.
- **Another system catching up a moment later is the design working.** Between systems,
  consistency is eventual.
- **Not everything gets a layer.** Code that asserts about the source tree rather than about the
  application sits outside these layers, and so do the module that assembles them, a system's
  exported entries and the common library.
- **The checklist is a prompt to look.** Concluding that a case is fine is a complete answer.

## What this does not cover

- Where UI code goes: `components.md`.
- Library, framework and file-naming conventions: the stack document.
- Whether a module that straddles two layers should be split now.
