# Layers

Where server code goes and what it is allowed to touch.

**Preconditions.** The repository layer assumes a store that can be read and written. Where this
document says *transaction*, it assumes the store can apply several writes atomically; if yours
cannot, question 5 does not apply. *Table*, *row* and *aggregate* are used in the relational
sense — substitute your store's equivalents.

**Terms.** A *controller* is a boundary adapter: it resolves the caller, validates, calls into
one thing, and returns. It holds no rules of its own. `components.md` applies the same role to
route files on the client; the difference is writes — a server controller passes a write through
to one service, a route controller does not carry writes at all.

This document is written for review. The faults below are the ones a linter cannot see, because
they are about what a function *does* rather than where it imports from.

## The layers

| layer | what it is | may import | must not |
| --- | --- | --- | --- |
| **domain** | pure rules, no I/O | other domain modules — and nothing outside itself | the store, an adapter, a repository |
| **repository** | one aggregate's tables. Composes nothing | the store client, the domain | another repository, and a service above all |
| **service** | use cases. **The only entry for doing something** | repositories, domain, infrastructure, other services | write a table with its own queries |
| **infrastructure** | external systems: mail, rendering, third-party APIs, auth | domain, and the repository holding an adapter's own settings row | a service |
| **controllers** | boundary adapters: entry points, their validators | services, domain, session infrastructure | repositories, the store, the query builder |

The arrow runs one way — controller → service → repository → store — and the domain sits beside
all of it: everyone may import it, it imports nobody.

A controller resolves the caller, validates, calls **one** service function, and returns what it
gives back. Needing two is the signal that a use case has grown inside a controller.

## The review checklist

Six questions, each answerable from a diff. The snippets are illustrative pseudo-code.

### 1. Does a service write a table another aggregate owns?

**In a diff:** an insert, update or delete inside a service, or a service opening its own store
handle, against a table the file is not named after.

The write belongs to the repository that owns the table. The service hands that repository its
transaction and keeps the deciding.

```
// service/order.ts — the fault
tx.insert(invoices).values({ orderId, total })

// the fix: one call into the owning repository
invoiceRepo.createForOrder(tx, { orderId, total })
```

### 2. Is the new use case in a repository, or in a controller?

**In a diff:** a repository module that gained an import of a sibling repository, of an
infrastructure adapter, or of a service. Or a controller body that grew past "call one service".

A controller that hands a repository a transaction and a callback has not delegated a use case,
it has inlined one: the deciding still happens in the controller.

```
// controller — the fault
await orderRepo.withTransaction(async (tx) => { /* seven writes, four aggregates */ })

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
transaction it handed to another aggregate's repository**. Every aggregate written needs to be
named. The write the screen is obviously about is the easy half; the one further down the shared
transaction is the half that gets missed.

```
// settleOrder writes `orders` and clears `invoices.dunning_stage`
// declared: ["order"]            — the fault
// declared: ["order", "invoice"] — correct
```

`components.md` is the client-side form of this question.

### 5. Did one transaction quietly become several?

**In a diff:** an extracted function that opens its own store handle instead of taking the
caller's transaction; a loop that calls a write per item.

Moving a write out of a function tends to give it its own handle. A repository function takes
the caller's transaction and opens nothing. Writes that must land together take one transaction;
a loop calling the store per item is one transaction per item, and a failure halfway leaves the
use case half-applied.

```
// the fault
for (const line of lines) await db.transaction((tx) => lineRepo.insert(tx, line))

// the fix
await db.transaction((tx) => lineRepo.insertMany(tx, lines))
```

### 6. Does a repository import a service?

**In a diff:** a service import inside a repository file.

The first two faults seen from the other end, and the cheapest to spot. It means a use case is
parked in a repository.

## When to leave it alone

- **A service that only forwards to its repository is correct here**, not an unnecessary
  indirection. A controller's only door is a service, even when the service exports the same name
  again, so that deleting a repository fails inside the service that names it rather than at a
  controller naming a symbol.
- **A read across aggregates in a repository is a reporting read, not a use case**, as long as it
  writes nothing.
- **A service passing its transaction into another aggregate's repository is the design
  working.** That is how several tables stay one transaction.
- **A use case touching three aggregates and naming three invalidations is correct**, not a
  breach of one mutation per use case.
- **Not everything gets a layer.** Code that asserts about the source tree rather than about the
  application sits outside these layers.
- **The checklist is a prompt to look.** Concluding that a case is fine is a complete answer.

## What this does not cover

- Where UI code goes: `components.md`.
- Library, framework and file-naming conventions: the stack document.
- Whether a module that straddles two layers should be split now.
