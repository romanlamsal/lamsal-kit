# A hook fires on this system's own write

**Status:** closed (8deed33)

**Kind:** misleading wording · **Touches:** Products (the hooks bullet) · **Related:**
`14-hook-writes-product-transaction.md` (the decision tree); resolves `open-questions.md` D

## Context

In `domain.md`, shop writes price through Payload's Local API, and Payload runs shop's own
`afterChange` hook for that write.

## Problem

The hooks bullet reads: "**A product's hooks and scheduled tasks are driving adapters**, and the
constraints on driving adapters apply to them", for every hook. An editor's price action calls
shop's service; the service writes through the Local API; the hook fires and, as a driving
adapter, acts through one service. Under ticket 14's step 3 it writes a second outbox message for
one change; where its service writes the product again, the hook fires again, a loop.

## Resolution

Products, the hooks bullet, a branch in front of the tree:

> - **A product's hooks and scheduled tasks are driving adapters**, and the constraints on driving
>   adapters apply to them. For a hook, answer in order:
>   - **The product's caller is this system** → this system started the call, so it is not a
>     driving one: the hook does nothing, and the use case that called the product handles the
>     change. How the hook recognises this system as the caller is each codebase's choice.
>   - **It asks**, such as whether a change is valid → it asks, at any point.
>   - **It acts** → answer in order: *(steps 1–4 unchanged)*

## Grounding

- Cockburn, *Hexagonal Architecture*: the primary actor starts the conversation; driving and
  driven follow from who starts it *(from memory)*. `layers.md` Terms states it: "Who starts the
  call decides which."
- No source covers a product calling back on this system's own write.

## Done when

The branch passes the four tests and misplaces no edge case in `domain.md`; the sweep finds no
sentence that sends an own write through asks or acts; presented for approval.

## Decision

**A hook run for this system's own write is not a driving call.** Terms decides driving and driven
by who starts the call, not by who calls immediately: the product only carries this system's
call back to it. Derived, so reworded rather than added; the unconditional "hooks are driving
adapters" hid it. No "this document's choice" marker.

**The hook does nothing; the use case that called the product handles the change.** It already
does everything its change needs, including what the hook does for an editor's change, such as
revalidating a cached page ("naming three invalidations is correct"). The branch covers asks too:
the use case already applied the rule.

**Named by "the product's caller".** The term already exists in step 2, for the user signing up;
it now splits by who asked the product: this system, or anyone else. "Changes through the
product" and "changes the product's users make" were rejected: this system's Local API write goes
through the product, and this system is a client of it too.

**The mechanism is each codebase's choice.** Payload's `context` flag, an ORM hook guard, a
trigger condition: each product detects the caller differently. Stated positively in the branch.

**Considered options**

- Nothing in `layers.md` (open question D, option 2): leaves the hidden derivation, and an agent
  builds the duplicate message or the loop.
- Rewording the head to "driving adapters for what the outside starts": reads poorly, and
  scheduled tasks do not echo a write.
- A sentence before the tree instead of a branch: the tree is where the agent decides.

**Consequences**

- Ticket 14's Consequences line ("D … shows up as a message in the outbox under step 3") is
  superseded; left as history.
- The hooks bullet now nests two "answer in order" lists.
- The sentence "Where its caller delivers at least once — … a product's hook" is about repeated
  deliveries, not origin; unaffected.
