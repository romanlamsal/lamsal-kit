# A driving adapter decides nothing by this system's state

**Status:** closed (ac716ac)

**Kind:** contradiction (review 03, S1) and the unmarked choice behind it · **Touches:** Terms
(controller), The layers ("acts through one service" paragraph), Ports and factories ("imports
what is static", the ambient paragraph), Other systems ("takes its caller"), The review checklist
(question 2 tell), the layer table (service and driving rows, via the skill) · **Related:**
`review-03.md` R02-01, R02-18, R03-01, R03-05, R02-07, R03-16, Q1, Q2; `10-inbound-translation.md`
(R01-07, controllers receive the ports that resolve their caller)

Grilled and decided on 2026-10-21; the `## Decision` section is the ruling and the Resolution is
the agreed wording. A fresh session applies it: read `registry/docs/agents/layers.md` whole and
`docs/extending-layers.md`, then work the before/after pairs through steps 3–6 of the process
doc. The decision is not up for re-litigation; wording may be tightened where a test fails.

## Context

Terms lets a controller ask a specification "may this caller do this". Other systems scopes
"takes its caller as an argument" to a driving port another system calls, with "B's authorization
lives in its service or domain". The summary pass wrote "its driving port takes its caller, and
authorization lives here or in the domain" for every driving port (R03-01). The ambient paragraph
keeps "the user an audit column records until a rule decides by it" as a second home for the
caller (R03-05).

Two cold reads could not place a controller's permission check. `domain.md`: checkout is called
by shop's controller today and exported to another consumer tomorrow; a controller-side check is
bypassed. An adapter that needs loaded data to ask "may this caller do this" calls a service to
ask and a service to act: two calls, and question 2 fires (R02-01).

## Problem

The document has no general line for what a driving adapter may decide. The sources have one:
the adapter converts the outside's form into the port's form and the application "is blissfully
ignorant of the nature of the input device" (Cockburn); the application layer "makes no
assumptions about the source of the transfer request" (Evans p. 54); the presentation layer is
"limited to providing the required input to the service layer" (Khononov p. 122). Identity is a
security framework's or a generic subdomain's (Evans p. 290, Khononov p. 11), never this
system's. None of the three puts a decision in the adapter; none says an adapter may not read
state. The second half follows here from "its only door to the store is a service".

## Resolution

### 1. The layers, "acts through one service"

Before:

> **A driving adapter acts through one service and asks through the domain.** To act, it calls
> one service function; needing two is the signal that a use case has grown inside it. To answer
> a question about a rule — may this caller do this, is this input valid — it calls a
> *specification*: a domain function that takes the candidate and returns the answer. When the
> answer needs data the adapter does not hold, a service of its system loads the data and asks
> the specification.

After:

> **A driving adapter decides nothing by this system's state.** It prepares one call — resolving
> the caller, validating, translating, whatever else shapes the input — and acts through one
> service. A driving port takes what its use case decides by, the caller included. To act, the
> adapter calls one service function; needing two is the signal that a use case has grown inside
> it. To answer a question about input it holds — is this valid — it calls a *specification*: a
> domain function that takes the candidate and returns the answer. A question that needs this
> system's state — may this caller do this — is the acting service's: it loads the data, asks
> the specification, and refuses. A service that only answers, for a screen that hides a button,
> is called instead of acting, never before it. The conversion is Cockburn's adapter; that the
> adapter reads no state of its own follows from its only door being a service.

### 2. Terms, controller

Before:

> A *controller* is a driving adapter: it resolves the caller (a session, a signature, a key),
> validates, acts through one service, and returns.

After:

> A *controller* is a driving adapter: it resolves the caller (a session, a signature, a key)
> through a port it receives, validates, acts through one service, and returns.

### 3. Ports and factories, "imports what is static" (R03-16)

Before:

> A service, an adapter, a product's instance: received.

After:

> A service, an adapter — its own, or one that resolves or translates its caller — a product's
> instance: received.

### 4. Other systems, "takes its caller"

Before:

> **A driving port another system calls takes its caller as an argument.** A consumer reaches B's
> service without passing B's controllers, so whatever those controllers resolve — who is
> calling, on whose behalf — cannot come from them, and B's authorization lives in its service
> or domain.

After:

> **A driving port another system calls takes its caller as an argument**, as every driving port
> takes what its use case decides by (The layers). A consumer reaches B's service without passing
> B's controllers, so whatever those controllers resolve — who is calling, on whose behalf —
> arrives as an argument, and B's authorization lives in its service or domain, as it does for
> every caller.

### 5. Ports and factories, the ambient paragraph

Before: "the user an audit column records until a rule decides by it"

After: "the user an audit column records; what a rule decides by, the port takes"

### 6. The review checklist, question 2 tell (R02-07)

Before:

> Or a driving adapter's body that grew past "call one service"; resolving its caller and asking
> a specification are not growth.

After:

> Or a driving adapter's body that grew past "call one service"; preparing the call — resolving
> its caller, validating, translating, putting ambient values in, asking a specification — is
> not growth.

### Sweep

Grep `caller`, `specification`, `authoriz`, `resolves`, `asks through`. The table's service row
("its driving port takes its caller, and authorization lives here or in the domain") and driving
row ("acts through one service and asks through the domain", "a specification to ask") follow the
body through the `summarize-layers` skill. `components.md`'s controller sentence is R02-46, not
this ticket's.

### Applied

The six pairs went in as written; the cold read placed all four cases at 5. It noted two
stretch points, left as they are: "the caller included" can be read as unconditional (the
Decision's "a port no rule decides by takes none" is the intended reading, and the ambient
clause "what a rule decides by, the port takes" carries it); the service cell says "a permission
that needs this system's state" while Other systems says "B's authorization" unqualified — a
stateless permission is a specification either way, so both land in the service or the domain.
Table pass in the same commit: service row "its driving port takes what its use case decides by,
the caller included, and a permission that needs this system's state is decided here or in the
domain"; driving row "decides nothing by this system's state: prepares one call — resolving its
caller through a port it receives, validating, translating — and acts through one service", and
"a specification to ask about input it holds".

## Grounding

- Cockburn, *Hexagonal Architecture*: "As events arrive from the outside world at a port, a
  technology-specific adapter converts it into a usable procedure call or message and passes it
  to the application. The application is blissfully ignorant of the nature of the input device."
  "Allow an application to equally be driven by users, programs, automated test or batch
  scripts."
- Evans p. 53: the user interface layer is "interpreting the user's commands"; the application
  layer "does not contain business rules or knowledge". p. 54: "makes no assumptions about the
  source of the transfer request"; "that user interface could be replaced by a wire request in
  XML without affecting the application". p. 290: "a security framework will authenticate a
  user's identity and then limit access to specific features based on privileges" is not part of
  the domain vision; roles are in the model only "to feed necessary information to the security
  framework".
- Khononov p. 11: authentication and authorization are a generic subdomain. p. 122: "The
  presentation layer's responsibility becomes limited to providing the required input to the
  service layer and communicating its responses back to the caller."
- Vernon: from memory, silent on this.

The conversion is the sources'. "Decides nothing by this system's state" is the document's,
derived from "its only door to the store is a service"; validating against the domain schema at
the adapter rather than inside the service is the document's, for the single constructor
(question 3).

## Done when

The six pairs are applied; each new sentence passes the four tests; the sweep finds no sentence
placing a permission check in a controller or scoping "takes its caller" to exported ports; the
skill has rebuilt the table; a fresh agent with only `layers.md` places at confidence 4–5: a
controller checking "only the owner cancels" (fault, the service's); a controller resolving a
session through the auth system's port (correct, one service call stays one); a port exported to
a second consumer (nothing to bypass); ask-then-act in a controller (question 2). Committed per
`CLAUDE.md`; status set here, in `spec-01.md` and noted in `review-03.md`.

## Decision

**A driving adapter decides nothing by this system's state.** It prepares one call — resolving
the caller, validating, translating, and whatever else shapes the input; the list is open — and
acts through one service. Preparation uses what arrived and what other systems answer through
ports the adapter receives; it never uses this system's state, because the adapter's only door
to the store is a service. "Acts" carries the emphasis: resolving through a received port is not
a second act.

**A driving port takes what its use case decides by, the caller included.** Every permission
that depends on this system's state is the acting service's, in one shape: load, ask the
specification, refuse. "Every port takes its caller" follows wherever a rule decides by who; a
port no rule decides by takes none. What a rule does not decide by may stay ambient, which is the
ambient criterion the document already had.

**Identity is another system's.** Sessions, keys and signatures are the auth system's aggregates
(an auth library is another system; identity is a generic subdomain). A use case that resolves
exists, but it is that system's, reached through its driving port, received by the controller.
This system never has one, so "one service" is never two.

**Considered options**

- Every driving port takes its caller unconditionally: the same guarantee, plus a parameter
  nobody reads on ports no rule decides by.
- Keep today's text, a controller deciding from claims it holds: bypassed the day the port is
  exported.
- The service parses raw input (`unknown` ports): hexagonal too, but every in-process caller
  re-parses domain values; the document keeps the port in domain types for question 3.

**Consequences**

- Terms' "may this caller do this" moves from the adapter's specification example to the
  service's; the adapter's example is validity.
- R02-01 (ask-then-act), R02-18, R03-01 and R03-05 close with this ticket; R02-07's tell widens
  to preparation.
- The table cell "its driving port takes its caller, and authorization lives here or in the
  domain" follows the body: "takes what its use case decides by, the caller included".
