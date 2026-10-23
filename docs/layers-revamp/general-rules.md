# General rules

Rules whose Scope is any system. Terms are the glossary's; the rule shape is the README's. A rule
with `—` under Examples is unfinished.

## Assumptions

This document assumes a store that can be read and written, and that can apply several writes
atomically where it says *transaction*. *Record* is used in the relational sense, a row;
substitute your store's equivalent.

Not everything gets a layer. Code that asserts about the source tree rather than about the
application sits outside the layers, and so do assembly, a system's export paths and the common
library.

Not covered: where UI code goes, which is `components.md`; library, framework and file-naming
conventions, which are the stack document's; whether a module that straddles two layers should be
split now.

## Arrow

**ARR-1**
*Scope:* code of one layer of a system depends on code of another layer of the same system: it
imports it, receives it, or calls it.
*Statement:* The dependency MUST be one leg of the arrow: driving adapter to service, service to
driven adapter, driven adapter to the outside, any layer to the domain.
*Why:* A dependency that is no leg of the arrow lets one part of the system know what it has no
business knowing. A service that knows the route that calls it, or the store client that saves
for it, changes whenever either changes, and a second way in, or a second store, means rewriting
the use case. A driving adapter that skips the service and reaches a driven adapter or the store
reads state and decides by it, or writes outside any use case and the transaction a service would
hold, and the rules in the domain are bypassed for that one way in. A driven adapter that calls a
service has a use case inside it, in the layer meant to do nothing but talk to the outside. A
domain that depends on a layer drags that layer along wherever the domain is imported: a browser
importing a schema loads the server's store client with it. With the arrow one way, the system is
replaced from the outside in, a new driving adapter, a swapped driven adapter, with service and
domain untouched.
*Provenance:* Cockburn's hexagonal architecture: the application knows neither the adapters that
drive it nor those it drives. Khononov, ch. 8: ports and adapters invert the dependency, the
infrastructure layer depends on the business logic layer and not the other way around.
*Examples:* —

## Domain

**DOM-1**
*Scope:* a domain module imports a module.
*Statement:* The import MUST be one of: another domain module, a port of the common library, the
published language of an upstream this system conforms to, a library that computes from its
arguments.
*Why:* The test for a module is two questions: does calling it reach outside the process, and
does it exist on every runtime? A store client, an HTTP client, a mailer SDK, `node:fs` and a
clock reach outside, so they stay behind ports. A validation library takes arguments and returns,
so it passes, and so does any library like it. `node:path` reaches nowhere outside the process
and still breaks in a browser; `Buffer`, `process`, `window` and the DOM are one runtime's. A
domain that imports any of these loads on one runtime, and whoever imports it elsewhere, a browser
rendering a form from the schema, another system reading the published language, gets a load
error or the server's store client along with the model. A common-library module that itself
imports `node:async_hooks` carries the same problem one step removed.
*Examples:* —

**DOM-3**
*Scope:* a rule about the shape of a record: which fields it has, what each holds, which values a
status takes.
*Statement:* It MUST be stated once, as a schema in the domain.
*Why:* A schema says what the functions beside it say, in a form that also checks at runtime, and
the type is inferred from it. Stated a second time, as a type declared beside the schema, a
validator in a driving adapter, a second constructor in a client-side optimistic update, the two
drift, and the drift stays invisible until two parts of the system disagree about a rule neither
writes down. Everything that builds the record parses against the one schema or derives from the
one domain function, and a changed field lands as a compile error in every builder at once.
*Examples:* —

**DOM-4**
*Scope:* an aggregate needs something of another aggregate, or of data another system owns.
*Statement:* It MUST hold it as the other's id, or as a value copied when it needed it.
*Why:* The copy is this aggregate's fact from then on: the price the order was placed at stays
after the catalog changes it. A reference that loads the other's whole record makes the two one
aggregate, written by two sets of use cases (SYS-8), and carries the other's model into this one:
its fields, its rules, its changes. The repository then loads and saves, along with its aggregate,
what another repository owns.
*Provenance:* Vernon's aggregate rule: reference other aggregates by identity only.
*Examples:* —

**DOM-5**
*Scope:* this system declares a driven port.
*Statement:* The declaration MUST be in the domain.
*Why:* The rules say what they need, store this order, send this mail, and the driven adapters do
it; assembly picks which. Declared elsewhere, in a service module or beside the adapter, the
domain function that needs the port has no way to name it without importing a layer (DOM-1), so
the service ends up holding what the rules decide. Declared in the domain, a driven adapter
depends on the domain and nothing else of the system (ARR-1), and the fake and the real adapter
implement the same declaration.
*Examples:* —

**DOM-6**
*Scope:* a repository method takes a transaction to join.
*Statement:* Its type in the domain MUST be opaque: it names no store and no store client.
*Why:* The repository is a port in the domain (DOM-5), so its signature is domain code and goes
wherever the domain goes (DOM-1). A store client's type there names the store in every runtime
that imports the domain and ties the fake adapter to the real store's client. An opaque type, the
common library's transaction port's, lets the service pass the transaction through and the adapter
narrow it to what its store needs on its own side.
*Examples:* —

## Retired ids

Never reused: `ARR-2`, `ARR-3`, `DOM-2`, `DRV-2`, `DRV-4`, `DVN-3`, `PRD-1` to `PRD-5`, `SYS-4`,
`SYS-6`.
