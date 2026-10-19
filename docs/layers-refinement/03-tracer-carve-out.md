# Question 7 flags the tracer

**Status:** applied, uncommitted · **Kind:** misleading wording · **Touches:** Terms (common
library), question 7

## Context

In `domain.md`, the common library ships an OpenTelemetry tracer exporting to Jaeger. Services
and repositories call `trace.getActiveSpan()` to add attributes such as the order id.

## Problem

Question 7 lists as a fault "an ambient accessor that builds an implementation when the context is
empty". OpenTelemetry returns a no-op span when its context is empty: the sentence matches it
literally. An agent flags every tracing call, or wraps the tracer in a port nobody substitutes. It
should treat the tracer as it already treats the logger.

## Resolution

Question 7: "Plumbing with one fixed configuration, such as a logger or a tracer, may be a
ready-made instance: nobody substitutes it."

Terms: "the transaction port, store clients, a logger, a tracer, the outbox relay."

## Grounding

The derivation test: the logger carve-out already covers anything of the same shape; naming the
tracer makes the derivation visible. No source speaks to it.

## Done when

Approved and committed.
