// What a repository receives, in two files: layers.md (glossary, the world, each property with
// its rule, Scope and Statement; what binds) and layers-why.md (each property's and rule's Why and
// Provenance, under its id). Author-only parts of property-rules.md are dropped.
// Usage: node docs/layers-revamp/distill.mjs <dir>   writes <dir>/layers.md and <dir>/layers-why.md
//        node docs/layers-revamp/distill.mjs         prints both, layers.md first, for a review
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, name), "utf8").trimEnd();

const authorFields = ["Absorbs", "Drops", "Glossary notes", "Terms used"];
const reasonFields = ["Why", "Provenance"];
const fieldStart = /^\*([A-Za-z ]+):\*/;
const tidy = (text) => text.replace(/\n{3,}/g, "\n\n").trim();

function fail(message) {
  throw new Error(`distill: ${message}`);
}

/** Splits a document at its `### P<n>.` blocks inside `section`: head, blocks, tail. */
function splitBlocks(text, section, tailHeading) {
  const start = text.indexOf(`\n${section}\n`);
  if (start < 0) fail(`no "${section}"`);
  const end = tailHeading ? text.indexOf(`\n${tailHeading}`, start) : text.length;
  if (end < 0) fail(`no "${tailHeading}"`);
  const head = text.slice(0, start);
  const tail = text.slice(end);
  const blocks = [];
  for (const line of text.slice(start + section.length + 2, end).split("\n")) {
    if (/^### P\d+\. /.test(line)) blocks.push({ heading: line.slice(4), fields: [] });
    else if (!blocks.length) {
      if (line.trim()) fail(`text before the first block of "${section}": ${line}`);
    } else {
      const block = blocks.at(-1);
      const m = line.match(fieldStart);
      if (m) block.fields.push({ name: m[1], lines: [line] });
      else if (block.fields.length) block.fields.at(-1).lines.push(line);
      else if (line.trim()) fail(`text before the first field of ${block.heading}: ${line}`);
    }
  }
  for (const b of blocks) for (const f of b.fields) f.text = tidy(f.lines.join("\n"));
  return { head, blocks, tail };
}

const glossary = read("glossary.md");
const world = splitBlocks(read("the-world.md").replace(/^\*Draft\.\* /m, ""), "## Properties");
const rulesText = read("property-rules.md");
const rules = splitBlocks(rulesText.slice(0, rulesText.indexOf("\n## Appendix")), "## Rules", "## Conventions");

if (world.blocks.map((b) => b.heading).join("\n") !== rules.blocks.map((b) => b.heading).join("\n"))
  fail("the world's properties and the rules differ in headings");

const preambleOld = rules.head.match(/\n\*Draft\.\*[^]*?\n\n/);
if (!preambleOld) fail("no *Draft.* preamble in property-rules.md");
const rulesHead = rules.head.replace(
  preambleOld[0],
  "\nOne rule per property of the world, under the property's heading: Except and Against are the\n" +
    "property's, Scope and Statement are the rule, read as one. The glossary's terms, as spelled. Where\n" +
    "a property needs nothing a reader could breach, the entry says so. Conventions at the end are\n" +
    "taste, no property behind them.\n\n",
);

const keep = (fields, names) => fields.filter((f) => names.includes(f.name)).map((f) => f.text);

const core = [
  "# Layers\n\n" +
    "The glossary, the world and the property rules. Read whole.\n\n" +
    "**Why.** Where a decision contests a rule, or a Statement reads two ways: read the rule's entry\n" +
    "in `layers-why.md` (`## P<n>.`). It holds the property's and the rule's Why and Provenance.",
  glossary,
  tidy(world.head),
  tidy(rulesHead) +
    "\n\n## Rules\n\n" +
    rules.blocks
      .map((r, i) => {
        const w = world.blocks[i];
        const fields = [
          ...w.fields.filter((f) => !reasonFields.includes(f.name)).map((f) => f.text),
          ...keep(r.fields, ["Scope", "Statement"]),
        ];
        const unknown = r.fields.filter(
          (f) => ![...reasonFields, ...authorFields, "Scope", "Statement"].includes(f.name),
        );
        if (unknown.length) fail(`${r.heading}: unknown field ${unknown[0].name}`);
        return `### ${r.heading}\n\n${fields.join("\n")}`;
      })
      .join("\n\n") +
    "\n\n" +
    tidy(rules.tail),
].join("\n\n---\n\n");

const why = [
  "# Layers, why\n\n" +
    "Each property's and rule's Why and Provenance, under its id in `layers.md`. They bind nobody:\n" +
    "where one reads otherwise than a Scope or Statement, the Scope and Statement hold.",
  ...rules.blocks.map((r, i) => {
    const w = world.blocks[i];
    return [
      `## ${r.heading}`,
      `### Property\n\n${keep(w.fields, reasonFields).join("\n\n")}`,
      `### Rule\n\n${keep(r.fields, reasonFields).join("\n\n")}`,
    ].join("\n\n");
  }),
].join("\n\n");

const dir = process.argv[2];
if (dir) {
  writeFileSync(join(dir, "layers.md"), core + "\n");
  writeFileSync(join(dir, "layers-why.md"), why + "\n");
} else process.stdout.write(core + "\n\n---\n\n" + why + "\n");
