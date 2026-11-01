# Spec 02 — Work order after the full review

A session told "the next in the spec" works the first unchecked step, as a fresh session: the
README, `glossary.md`, `the-world.md`, `general-rules.md` and `choices.md` first (README, Working
here), then the step's issue. It checks the step in the commit that lands it.

The review that opened these issues ran at commit `ccfa1e9`: the README's seven reader kinds,
once over the input files and once over the output of `distill.mjs`. The reader files are
`reviews/02/`; the issues are the record of what the requester accepted. The
distilled output is what a repository reads, so a finding the distilled set made and the raw set
did not is a ruling that lives in a Why, a Relies-on line or a Provenance.

## Steps

- [x] 1. **Bookkeeping.** Issue 08 closed, superseded: its readers ran as this review, and its
  example items are issue 19's. Spec 01 step 9 checked. `distill.mjs` committed.
- [x] 2. **A rule placing business rules.** In the session that wrote this spec, no issue: no
  Scope holds for where a business rule sits; four readers of both sets found it, and P2 to P4
  hang on it.
- [x] 3. **The world and the glossary, issue 12.** First: the top tier, whose change sweeps every
  lower one. Steps 4 to 7 cite its properties and terms; step 9's stop keys to them.
- [x] 4. **Why to Scope or Statement, issue 13.**
- [x] 5. **Lists out of the distilled, issue 14.**
- [x] 6. **Glossary sweep, issue 20.** The terms steps 3 and 5 changed, swept into every rule and
  world line that leans on their old sense; Reach is transitive. Review 03 (`reviews/03/`, at
  `7858b71`) traced its four cannot-complies to them. Before step 7, so issue 15 rules on words
  that mean one thing.
- [x] 7. **Gaps and loose Statements, issue 15.** After steps 4 to 6, so it rules on settled
  text. Three passes: its regressions reopened it once and added TX-48 and TX-49 (issue 15,
  Since regression).
- [ ] 8. **Relies-on sweep, issue 16.** After every Scope and Statement change: the lines claim
  against them.
- [ ] 9. **Fixture facts, issue 17.** Before examples: writers that invent a fact or a shape
  disagree with each other.
- [ ] 10. **The stop, issue 18.** Before examples: step 11's writers report a detour instead of
  building it.
- [ ] 11. **Examples, issue 19.** Last of the writing steps: it illustrates the rules as steps 2
  to 8 leave them.
- [ ] 12. **Readers.** The requester runs them over the state step 11 leaves: the regular readers,
  Implementer and Fresh repo, both sets (README, Testing); the optional kinds on request. No
  issue; what they find opens the next spec.
