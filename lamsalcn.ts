import process from "node:process";

if (process.argv[2] === "init") {
    import("./cli/init")
}

if (process.argv[2] === "add") {
    import("./cli/add")
}
