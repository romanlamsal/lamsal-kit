# Choices

Choices the documents leave to a repository: a situation where more than one design holds every
property and breaks no rule. One is found where a review's drafts differ and each holds, and is
recorded here so the next review does not find it again as a gap. Internal: `distill.mjs` leaves
this file out, no reader receives it, and a repository is told nothing of it.

The session accepting a review's findings reads this file first. A finding that lands on an entry
is none. Drafts that agree where an entry says they may differ mean a rule or a property closed
the choice since; the session decides whether that was meant. Meant, the entry closes naming what
closed it; not meant, that rule or property is the finding. A closed entry stays.

One entry: an id, stable like a rule id; a Status, `open` with where it was found, or `closed by`
what closed it and the issue that called it meant; a Situation, in prose; a Bound, the property
and rule ids every design still holds; a Refused, one design the Bound rules out.

**C1**

*Status:* open, from the Assumptions of `general-rules.md`.
*Situation:* A downstream system takes an upstream's model as it is, or translates it at its
border.
*Bound:* P1, P12.
*Refused:* The upstream's terms inside the downstream's domain because its package was at hand,
nobody having chosen them.

**C2**

*Status:* open, from the Assumptions of `general-rules.md`.
*Situation:* Work spanning systems is choreographed, each system acting on what the others
publish, or orchestrated, one system telling the others what to do next.
*Bound:* P16, P17.
*Refused:* Two systems' parts of the work in one transaction, so that it cannot stop halfway.
