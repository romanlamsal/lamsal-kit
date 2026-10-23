# General rules

Rules whose Scope is any system. Terms are the glossary's; the rule shape is the README's. A rule
with `—` under Examples is unfinished.

## Assumptions

This document assumes a store that can be read and written, and that can apply several writes
atomically where it says *transaction*. *Record* is used in the relational sense, a row;
substitute your store's equivalent.

Not everything gets a layer. Code that asserts about the source tree rather than about the
application sits outside the layers, and so do assembly, a system's export paths and the common
library.

Not covered: where UI code goes, which is `components.md`; library, framework and file-naming
conventions, which are the stack document's; whether a module that straddles two layers should be
split now.

## Retired ids

Never reused: `DOM-2`, `DRV-2`, `DRV-4`, `DVN-3`, `PRD-1` to `PRD-5`, `SYS-4`, `SYS-6`.
