import path from "node:path";
import os from "node:os";
import { mkdtemp } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { buildFile, LangoError } from "./compiler.mjs";

const [command, inputPath, ...rest] = process.argv.slice(2);

if (command === "build" && inputPath && rest.length === 2 && rest[0] === "--out") {
    try {
        await buildFile(path.resolve(inputPath), path.resolve(rest[1]));
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = error instanceof LangoError ? 1 : 2;
    }
} else if (command === "run" && inputPath) {
    try {
        const directory = await mkdtemp(path.join(os.tmpdir(), "lango-run-"));
        const outputPath = path.join(directory, "main.mjs");
        await buildFile(path.resolve(inputPath), outputPath);
        const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
        const program = await import(pathToFileURL(outputPath).href);
        if (typeof program.main !== "function")
            throw new Error("Lango run requires an exported main(args)");
        runtime.configure({ output: (value) => console.log(value) });
        await program.main(rest);
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = error instanceof LangoError ? 1 : 2;
    }
} else {
    console.error("Usage: node src/cli.mjs build <input.lango> --out <output.mjs>\n       node src/cli.mjs run <input.lango> [args...]");
    process.exitCode = 2;
}
