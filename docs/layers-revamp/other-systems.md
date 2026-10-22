# Other systems — specialized rules

Specialized rules for one system talking to another. Each narrows a general rule to a case; it
names the ids it narrows and nothing above it points down here. Same parts as a general rule,
plus *Narrows:* right after the statement.

**S-SYS-1.** Behind an anti-corruption layer, a command to the upstream is this system's private
message. The service handling it reaches the upstream through the driven adapter that translates.
*Narrows:* TX-3 step 1, MSG-6, MSG-7, SYS-3.
*Why:* the upstream's command type is in the upstream's published language (glossary: upstream
system), and behind an anti-corruption layer that language stops at this system's adapters. So the
service cannot write the upstream's command; it writes its own, the upstream handles no message of
this system, and TX-3 step 1 lands on a handler of this system, whose service makes the call
(MSG-7) through the port this system declared (SYS-3).
*Looks like:* a service behind an anti-corruption layer writing the upstream's command type to the
outbox; the upstream's command type imported into this system's domain.
