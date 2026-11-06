// What a repository receives: glossary and the world whole, then property-rules.md without its
// author-only parts. Usage: node docs/layers-revamp/distill.mjs > out.md
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, name), "utf8").trimEnd();

const dropFields = ["Absorbs", "Drops", "Glossary notes", "Terms used"];
const fieldStart = /^\*([A-Za-z ]+):\*/;

function stripRules(text) {
  const out = [];
  let dropping = false;
  for (const line of text.split("\n")) {
    if (/^## Appendix/.test(line)) break;
    const m = line.match(fieldStart);
    if (m) dropping = dropFields.includes(m[1]);
    else if (/^(#|\s*$)/.test(line)) dropping = false;
    if (!dropping) out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

const parts = [
  "# Layers, distilled\n\nThe glossary, the world and the property rules. Read whole.",
  read("glossary.md"),
  read("the-world.md").replace(/^\*Draft\.\* /m, ""),
  stripRules(read("property-rules.md")),
];
process.stdout.write(parts.join("\n\n---\n\n") + "\n");
