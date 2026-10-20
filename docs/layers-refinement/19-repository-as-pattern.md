# Repository is a pattern, not a layer

**Status:** ready

**Kind:** contradiction, this document's narrowing the sources do not share · **Touches:**
Preconditions, Terms, The layers (the table and the arrow), the DDD-vocabulary paragraph, Ports
and factories, Other systems (ACL bullets), checklist questions 1, 2, 5, 6, 7, Tests, When to
leave it alone · **Related:** `review-01.md` R01-59 (the trigger), R01-45 (the infrastructure
narrowing this removes), R01-53 (an owned aggregate stored in a product), R01-60 and R01-61
(next, after this ticket)

Grilled and decided on 2026-10-20; the `## Decision` section below is the ruling. A fresh session
applies it: read `registry/docs/agents/layers.md` whole and `docs/extending-layers.md`, then work
the inventory under Resolution through steps 3–6 of the process doc. The decision is not up for
re-litigation; the wording of each sentence is.

## Context

`layers.md` has five layers: domain, repository, service, infrastructure, controllers. Repository
and infrastructure are "both driven-adapter layers; they differ only in subject matter, one
implementing ports for this system's aggregates and the other for somebody else's". The repository
row may import "the store client, the common library, the domain"; the infrastructure row may
import the published language and driving-port types of the system it translates.

In `domain.md`, shop's `price` aggregate is stored in a Payload document, written through
Payload's Local API. Payload is a product, so another system.

## Problem

R01-59, found by a fresh agent placing the Payload scenario from `layers.md` alone (confidence 3):
the adapter that writes shop's price through Payload is a repository by subject ("this system's
aggregates, wherever they are stored") but may not be one by imports (a product's instance and
types are a published language, which only infrastructure may import). No row fits an owned
aggregate stored in a product.

The cause is not the import list. It is the layer split itself. The sources have one
driven-adapter layer and know *repository* only as a pattern:

- Evans, ch. 4 (manuscript pp. 54–55): the infrastructure layer provides "generic technical
  capabilities that support the higher layers: message sending for the application, persistence
  for the domain". Ch. 6 (pp. 107–111): a REPOSITORY lets the client "talk to a simple,
  intention-revealing interface, and ask for what it needs in terms of the model"; its
  implementation "will delegate to the appropriate infrastructure services"; "teams add a
  framework to the infrastructure layer to support the implementation of repositories"; the
  ideal is that "client code will be the same whether the data is stored in an object database,
  a relational database, or simply held in memory".
- Khononov, ch. 8 (pp. 126–127): "the business logic layer defines 'ports' that have to be
  implemented by the infrastructure layer. The infrastructure layer implements 'adapters'".
  Repositories appear in his code only as interfaces an application service receives.
- Cockburn, *Hexagonal Architecture*: adapters are "driving adapters and driven adapters", nothing
  finer; the repository is the Stage 3 example of a driven adapter.
- Vernon, *IDDD* ch. 4 and 12 *(from memory, not on disk)*: the repository interface in the domain
  module, its implementation under the infrastructure module's persistence adapters.

A second narrowing falls with it: `layers.md`'s *infrastructure* holds driven adapters only, while
Khononov's holds both sides (R01-45, marked in the DDD-vocabulary paragraph). The author's
preference, stated in the grilling: the driving/driven port and adapter language of the sources,
which does not distinguish kinds of adapter.

## Resolution

Four layers: **domain**, **service**, **driven adapters**, **driving adapters**. *Repository* stays
as Evans's pattern: the driven port over one aggregate's storage, declared in the domain,
implemented by a driven adapter like any other. *Infrastructure* and *controllers* stop being
layer names; "controller" may stay as the example of a driving adapter. The arrow becomes
"driving adapter → service → driven adapter → the outside". The properties the two old rows
carried move under the driven-adapters row as sentences by subject.

Inventory, every sentence the change touches, by the text at HEAD `33b7899` (re-anchor by quoted
text; line numbers shift):

| where | now | becomes |
| --- | --- | --- |
| Preconditions, first sentence | "The repository layer assumes a store that can be read and written." | "An adapter over an aggregate's storage assumes a store …" (or: "This document assumes a store …") |
| Terms, ports paragraph | "Controllers are driving adapters; repositories and infrastructure hold driven adapters." | "A controller is a driving adapter; a repository is a driven port over one aggregate's storage, and its adapter is a driven adapter like a mailer's." |
| Terms, same paragraph | "where this document narrows a term, the narrowing applies" and the `*repository* as a layer` narrowing named in `extending-layers.md` | the narrowing is gone; `extending-layers.md`'s example ("as it does for *repository* as a layer") needs a new example or drops the clause |
| The layers, table | five rows | four rows. **driven adapters**: what it is: "implementations of this system's driven ports: an aggregate's repository, a mailer, a clock, a cache, blob storage, another system behind an anti-corruption layer"; may import: "whatever its port's implementation needs — a store client, a product's instance, an HTTP client — and the domain, the common library, and the published language and driving-port types of a system it translates"; does: "an adapter over this system's aggregate serves one aggregate for writes, composes nothing, and joins the caller's transaction; an adapter over another system translates between this system's ports and that system". **driving adapters**: the old controllers row, "controllers" replaced by "entry points: controllers, hooks, scheduled tasks, message handlers, their validators" |
| The layers, arrow | "controller → service → repository → store" | "driving adapter → service → driven adapter → the outside" |
| The layers, after the arrow | "Repository and infrastructure are both driven-adapter layers; they differ only in subject matter, one implementing ports for this system's aggregates and the other for somebody else's." | drop; the subject split is now two sentences in the row |
| The layers, "Imports no layer" paragraph | check for layer names | reword to the four |
| DDD-vocabulary paragraph | "**infrastructure** and **repository** are both infrastructure (Khononov's infrastructure also holds the driving adapters this document puts in controllers), and **controllers** are the interface layer" | "**driven adapters** are Khononov's infrastructure layer less its driving side, which is **driving adapters**, Evans's interface layer. A *repository* is Evans's pattern: a driven port over one aggregate's storage." The R01-45 marker goes; nothing is narrowed any more |
| Ports and factories, first sentence | "adapters in the repository and infrastructure layers implement it" | "driven adapters implement it" |
| Ports and factories, factory snippet | `orders: OrderRepository // driven port, from the domain` | unchanged: the repository is the port |
| Other systems, "B's service in-process, or an HTTP client in A's infrastructure" | layer name | "a driven adapter of A" |
| Other systems, ACL bullets: "an adapter in infrastructure implements it", "in that adapter, or in infrastructure shared with the outbound adapter" | layer name | "a driven adapter implements it"; "in that adapter, or in a module both adapters share" |
| Question 1, "Does a service write a table itself?" | "The write belongs to the repository that owns the table … one call into the owning repository" | unchanged in substance: the repository is the port over that aggregate |
| Question 2, "Is the new use case in a repository, or in a controller?" | "a repository module that gained an import of a sibling repository, of an infrastructure adapter, or of a service" | "a driven adapter that gained an import of another driven adapter or of a service"; title: "Is the new use case in a driven adapter, or in a driving one?" |
| Question 5 | "another aggregate's repository", "a repository method that takes the context" | unchanged: repository as port |
| Question 6, "Does a repository import a service?" | title and tell | "Does a driven adapter import a service?"; "It means a use case is parked in a driven adapter" |
| Question 7 | `createPostgresOrderRepository(db)` in a service file; `infrastructure/pricing.ts` in question 8's snippet | unchanged; rename the snippet path only if the stack document names folders by layer (it does not; folders are the stack document's) |
| Tests | `describeContract("OrderRepository", …)`; "driving adapters receive ports" | unchanged |
| When to leave it alone | "A service that only forwards to its repository", "A read across its system's aggregates in a repository is a reporting read", "another repository of its system, in the same store" | unchanged: repository as port; check "in a repository" reads as "in an aggregate's adapter" |
| `extending-layers.md`, the narrowing example | "as it does for *repository* as a layer" | pick another marked narrowing, such as *store* (Preconditions) |
| `review-01.md` R01-45, R01-59 rows | | note "resolved by ticket 19" |
| `domain.md`, placed-as-fault list | | add: "shop's price adapter over Payload's Local API is a driven adapter and imports Payload's instance (ticket 19)" |
| `spec-01.md` Ruled out, "the repository maps it" ×2 | | reads fine as the pattern; leave |

Sibling docs in `registry/docs/agents/` (`components.md`, `tanstack-start.md`) mention no
repository or infrastructure layer; nothing to sweep there.

## Grounding

Quoted under Problem. All four sources agree; nothing here is this document's choice, so no
marker. The remaining narrowing in the document is *store* (Preconditions), which stays marked.

## Done when

Every row of the inventory is applied or consciously left; the four tests pass on each new
sentence; a fresh agent with only `layers.md` places, at confidence 4–5: the Payload price adapter
(R01-59's scenario: which layer, what it may import), question 1 (a service inserting into
`orders`), question 2 (a use case in an adapter), question 5 (a transaction context across two
aggregates' adapters), question 6 (an adapter importing a service), and the ACL case (an adapter
over a third-party API). Committed per `CLAUDE.md`; status here and in `review-01.md` set.

## Decision

**Repository is Evans's pattern, not a layer.** The word stays for the driven port over one
aggregate's storage, declared in the domain and implemented by a driven adapter. Questions 1, 2, 5,
6 and rule 3 keep their tells by it. Dropping the word too would cost the checklist its sharpest
tells; the books keep it as a pattern.

**Layer names are the sources' adapter words.** Domain, service, driven adapters, driving adapters.
*Infrastructure* goes as a layer name: Evans and Khononov scope it differently, and the document
had to mark its own narrowing of it (R01-45). *Controllers* goes as a layer name and stays as the
example of a driving adapter. The arrow reads "driving adapter → service → driven adapter → the
outside".

**The subject-specific properties survive as sentences, not rows.** An adapter over this system's
aggregate serves one aggregate for writes, composes nothing, joins the caller's transaction; an
adapter over another system translates between this system's ports and that system. Question 5
and the anti-corruption-layer paragraph keep their ground. The split by subject was never the
fault; the split into layers was.

**Considered options**

- Widen the repository row's import list to "the store client, or a product's instance" (R01-59's
  proposal (a)): keeps a layer no source has, and the R01-45 marker with it.
- Make the Local API adapter infrastructure and drop "wherever they are stored" (proposal (b)): an
  adapter for an owned aggregate would sit as if the aggregate were another system's data, the
  confusion R01-53 just removed.

**Consequences**

- R01-59 closes by derivation: a driven adapter imports what its port's implementation needs.
- R01-45's marker is gone with the narrowing it marked.
- `extending-layers.md` loses its example of a marked narrowing and needs another.
- Consuming repositories that copied `layers.md` with a `repository/` folder are unaffected:
  folders are the stack document's, and the pattern keeps its name.
- Ticket 08 ("assembly per process") and R01-60 are next: the layer table no longer names
  controllers, which bears on "hands the result to the controllers" and on driving adapters a
  framework constructs.
