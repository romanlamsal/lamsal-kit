# One assembly module, several processes

**Status:** closed (c40be8e)

**Kind:** misleading wording · **Touches:** Ports and
factories ("Assembly is not a layer")

## Context

In `domain.md`, the web server and fulfillment's worker are separate processes with separate
entry points.

## Problem

"One module builds the adapters" reads as one module for the codebase. An agent makes the worker
import the web server's assembly and build adapters it never uses, or merges both entry points.

## Resolution

> **Assembly is not a layer.** One module per process builds the adapters, calls the factories,
> and hands the result to the controllers.

Process bootstrap (preloading OpenTelemetry instrumentation before any import) is the stack
document's concern and stays out.

*Superseded in part by `20-root-per-entry.md` (R01-60): one root per entry, not one module per
process. The bootstrap ruling stands.*

## Grounding

No source speaks to it; composition per process is the plain reading of a composition root.

## Done when

Approved and committed.
