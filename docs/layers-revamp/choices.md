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

**C3**

*Status:* open, from review 02 (issue 12).
*Situation:* Where the cut between systems lies: wide systems that each hold several parts of the
business, or narrow ones.
*Bound:* P3, P11, P19.
*Refused:* One system whose business rules change for different reasons yet share one model, so
that a billing change edits checkout's code.

**C4**

*Status:* open, from review 02 (issue 12).
*Situation:* A record an external system keeps is owned by the external system, its business
rules in the external system's configuration, or by a system of this codebase, the external
system's own ways in kept from changing it.
*Bound:* P11; SYS-12.
*Refused:* A system of this codebase deciding the record by its business rules while the external
system's own ways in change it as well.

**C5**

*Status:* open, from review 02 (issue 12).
*Situation:* Where the relay keeps its marks of an external system's outbox: on the external
system's records or apart from them.
*Bound:* P8, P9; TX-20.
*Refused:* A relay that marks a message before the bus has it.

**C6**

*Status:* open, from review 02 (issue 12).
*Situation:* A use case that needs an answer from another system of this codebase now calls that
system's open host service, or the work goes by messages and the caller waits on the answer.
*Bound:* P15, P17; TX-12, TX-30.
*Refused:* A call made where no business rule needs the answer now, so that the caller is down
whenever the other system is.

**C7**

*Status:* open, from review 02 (issue 12).
*Situation:* A migration that changes a deployed store runs as tooling, or as code of the system
whose records it changes.
*Bound:* P11, P14.
*Refused:* A migration that changes what a record means while code still running reads it the old
way.
