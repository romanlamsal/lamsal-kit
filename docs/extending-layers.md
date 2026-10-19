# Extending layers.md

How to change `registry/docs/agents/layers.md` when a session ran into a problem with it.

`layers.md` is the smallest set of guidance that leads to good server architecture: DDD and ports
and adapters, fitted to this author's preferences, close enough to the books that an agent who
knows them grasps the intent at once. It is not a log of decisions. A repository's own choices go
into that repository's ADRs.

The registry copies `layers.md` into consuming repositories as `docs/agents/layers.md`. A copy
edited there has drifted; carry the general part of the edit here, and leave the rest in that
repository.

## The sources

The reader knows these. `layers.md` documents its reading of them, not their content.

| source | what `layers.md` takes from it |
| --- | --- |
| Evans, *Domain-Driven Design* (2003) | the model, aggregates, repositories, layering, bounded contexts, the context map, specification |
| Vernon, *Implementing Domain-Driven Design* (2013) | ports and adapters joined to DDD; aggregates refer to each other by id |
| Khononov, *Learning Domain-Driven Design* (2021) | integration patterns, subdomain types, ownership vs physical boundaries, the outbox |
| Cockburn, *Hexagonal Architecture* (2005) | ports, driving and driven, adapters on both sides |

**Fallback sources.** Where the four are silent, check these before calling a sentence this
document's choice. The reader is not assumed to know them, so `layers.md` still marks such a
sentence as its own; the ticket records the fallback grounding.

| source | what it grounds |
| --- | --- |
| Fowler, *Patterns of Enterprise Application Architecture* (2002) | separated interface, unit of work, registry; a business transaction spanning several system transactions |
| Richardson, *Microservices Patterns* (2018) | saga steps: compensatable, pivot, retriable |

Use a book's term in its book meaning. Where the books lack a concept, coin a plain term and
define it in Terms (*system*, *common library*). Where `layers.md` narrows or
departs from a book, it says so in one clause, as it does for *repository* as a layer.

## Steps

1. **State the issue as a decision.** Name the decision an agent made wrong, or could not make,
   and what it did instead. Done when the issue reads as "the agent did X; it should have done Y".
2. **Find the cause in `layers.md`.** Read the whole file. Quote the sentences that led to X, or
   confirm that none speaks to the case. Done when the issue is one of: misleading wording, a
   contradiction, a real gap, or specific to one repository.
3. **Run the tests below.** Then walk each proposed sentence through the review domain in
   `docs/layers-refinement/domain.md`: an edge case there that it now places wrongly is a
   contradiction to fix before drafting. Done when every proposed sentence passes all four and
   misplaces no edge case.
4. **Draft the smallest change.** Reword before adding; add a clause before a sentence, a sentence
   before a section. State the property the code has, not an instruction: "a message's schema
   stays backward and forward compatible", not "change a message's schema so that …". For
   wording, follow the `mattpocock-skills:writing-for-agents` skill.
5. **Sweep for consistency.** Grep every term the change touches across Terms, the table, the
   sections, the checklist, "When to leave it alone", and the sibling docs in
   `registry/docs/agents/`. Done when no sentence contradicts the change.
6. **Present, then commit on approval**, per `CLAUDE.md`.

## The four tests

- **Gap test.** Name the decision the sentence guides, and what an agent does wrong without it.
- **Derivation test.** Check whether the sentence follows from definitions already there. When it
  does, the fix lies in the wording that hid the derivation, not in a new sentence.
- **Generality test.** The sentence guides that decision in any codebase. What holds for one
  product or framework belongs to that repository.
- **Source test.** Hold the sentence against the sources; where they are silent, against the
  fallback sources. Where it is stricter or looser than a book, mark it as this document's choice.
