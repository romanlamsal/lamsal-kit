#! /usr/bin/env node

import process from "node:process"

if (process.argv.includes("--version")) {
    await import("./package.json").then(({ version }) => console.log("Version:", version))
    process.exit(0)
}

if (process.argv[2] === "init") {
    await import("./cli/init")
}

if (process.argv[2] === "add") {
    await import("./cli/add")
}
