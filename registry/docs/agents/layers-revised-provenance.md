# Layers — provenance

Sources behind `layers-revised.md`, and where it departs from them, by rule id. The sources are
Evans, Vernon, Khononov and Cockburn.

| rule | source / departure |
| --- | --- |
| Terms: port, adapter, repository | Ports and adapters as Vernon joins it to DDD. A *repository* is Evans's pattern. |
| Terms: the layers | *Driving adapters* are Evans's interface layer and *driven adapters* his infrastructure layer; Khononov's infrastructure layer holds both. |
| Terms: ambient value | Fowler's registry, in two scopes; *ambient* is this document's word. |
| Terms: saga | Richardson's sense — the whole sequence — rather than Khononov's coordinating component. |
| DRV-1 | The conversion is Cockburn's adapter; that the adapter reads no state of its own follows from its only door being a service. |
| DRV-3, ASM-1 | One root per entry, that a driving adapter never imports it, and the courier are this document's choices. In Cockburn's example the driving adapter wires the application itself; Khononov resolves ports "in the infrastructure layer, either through dependency injection or by bootstrapping" (p. 128). A root apart from the driving adapters is this document's. |
| DVN-2 | That adapters are received is Khononov's (p. 128) and Cockburn's; the split between imported and received is this document's. |
| ASM-3 | The per-process scope is a service locator in Fowler's terms, and a departure from the injection the sources prefer, confined to the courier case. Where the line between ambient and argument falls is this document's choice. |
| SVC-3 | Khononov's application service is the transaction. |
| SYS-2 | Khononov keeps the published language and the domain apart from the start; re-exporting the domain, messages included, is this document's choice. |
| SYS-5 | Conformist as the default for an open host is this document's choice. The context-map patterns are DDD's. |
| TX-3 step 3 | One transaction across several aggregates is this document's choice; Vernon and Khononov keep one aggregate per transaction. |
| S-TX-1 | This document's choice; the sources do not cover a call after the commit. |
| S-PRD-1 steps 3.2–3.4 | This document's choice; the sources do not cover a product's transaction. |
