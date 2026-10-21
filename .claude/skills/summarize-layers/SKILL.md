---
name: summarize-layers
description: Summarize `layers.md` into its layer table and cite every entry in `citations.md`. Use after changing any sentence of `registry/docs/agents/layers.md`, or when asked to check, redo or extend the table.
---

# Summarize layers

The table at the top of `registry/docs/agents/layers.md` ("The layers") is a summary of the
document for an agent that will not read all of it. Every entry in it follows a sentence of the
body; the table states no rule of its own. `citations.md`, beside this file, holds the sentence
behind every entry and is always complete.

A **pass** rebuilds the table from the body and the previous citations. The first pass had no
previous citations and built from the body alone.

## Steps

1. **Read, whole:** `registry/docs/agents/layers.md`, then `citations.md`. Done when you hold
   every bold lead of the body and every entry the table has now.
2. **Inventory the leads.** List every bold lead in the body (the sentence in `**…**` that opens
   a paragraph or bullet), with its section. Add the plain sentences the current entries cite
   that have no lead. Done when the list covers the body from Preconditions to When to leave it
   alone.
3. **Place each lead.** For each, decide the row it binds and the column it fills, by the column
   tests below. A lead that binds no one layer, or fails every column test, goes to "leads
   with no row" with the reason. A current entry whose sentence is gone, reworded past
   recognition, or fails its column test goes to "entries dropped" with the reason. Done when
   every lead and every current entry is placed or listed.
4. **Write the table.** Four rows, four columns, `rules` entries shortened from their leads,
   about five per cell as a guideline. The paragraph under the table carries the import rule
   in one sentence; nothing else of the body moves. Done when every cell reads as a pointer, not
   a paragraph.
5. **Write `citations.md`,** the whole file, per the format below. Done when every entry in the
   table has a citation whose quoted sentence you re-read in the body of step 1 verbatim.
6. **Verify.** For each citation, find its quote in `layers.md` as it is now; for each lead in
   the step-2 inventory, find it as an entry or in "leads with no row". A miss sends you back to
   step 3. Done when both searches find everything.
7. **Commit** the table and `citations.md` together, conventional commits (`docs(layers):
   summarize layer table`), the commit body listing entries added and dropped. A pass that
   changes no cell commits `citations.md` alone when it changed.

## Columns

| column | holds | test |
| --- | --- | --- |
| `goes here` | the kind of code that lands in the layer | a sentence of Terms or The layers names it as this layer's |
| `in → out` | how the layer is reached and what it reaches, by port | follows Terms (ports, adapters) or the arrow sentence |
| `rules` | the rulings that bind the layer | a bold lead, or the plain sentence a ruling has instead; about five |
| `read` | sections to open for the why | the sections the row's citations name |

A ruling that binds several layers goes in the row of the layer it constrains: the outbox binds
the service, a hook's order of answers binds the driving adapter.

## `citations.md`

```
# Citations for the layer table

## <layer>

### goes here
- <cell text> — <section>: "<sentence, verbatim>"

### in → out
- <cell text> — <section>: "<sentence>"

### rules
- <entry> — <section>: "<bold lead or sentence, verbatim>"

### read
- <section>, <section>

## Leads with no row
- "<lead>" — <section>: <reason: cross-cutting; a Products step; marks a choice; …>

## Entries dropped
- <entry> — <reason: no sentence; sentence reworded to …; fails the column test>
```

One file, current state only; its history is `git log` of the file.

## Sources

A pass may add, after a citation, the grounding the body or a ticket's Grounding section names:
a book and page, or "this document's choice". Where a book says otherwise than a cell, the cell
stays as the body has it, and the disagreement becomes a finding for `docs/layers-refinement/`.
