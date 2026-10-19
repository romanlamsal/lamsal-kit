# `lines` names both the repository and the array

**Status:** applied, uncommitted · **Kind:** misleading wording · **Touches:** question 5's
snippet

## Problem

```
for (const line of lines) await tx.run((ctx) => lines.insert(ctx, line))
await tx.run((ctx) => lines.insertMany(ctx, lines))
```

`lines` is the repository and the data. An agent reading it cannot tell which is which.

## Resolution

The repository becomes `orderLines`:

```
for (const line of lines) await tx.run((ctx) => orderLines.insert(ctx, line))
await tx.run((ctx) => orderLines.insertMany(ctx, lines))
```

## Done when

Approved and committed.
