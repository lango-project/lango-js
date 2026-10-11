import path from "node:path";
import os from "node:os";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { buildFile, formatSource, LangoError } from "./compiler.mjs";

const [command, inputPath, ...rest] = process.argv.slice(2);
const displayError = (error) => error instanceof LangoError && error.diagnostics
    ? error.diagnostics.map((item) => item.message).join("\n")
    : error instanceof Error ? error.message : error;

if (command === "build" && inputPath && rest.length === 2 && rest[0] === "--out") {
    try {
        await buildFile(path.resolve(inputPath), path.resolve(rest[1]));
    } catch (error) {
        console.error(displayError(error));
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
        console.error(displayError(error));
        process.exitCode = error instanceof LangoError ? 1 : 2;
    }
} else if (command === "test" && inputPath && rest.length === 0) {
    try {
        const directory = await mkdtemp(path.join(os.tmpdir(), "lango-test-"));
        const outputPath = path.join(directory, "main.mjs");
        await buildFile(path.resolve(inputPath), outputPath, new Set(), true);
        const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
        const program = await import(pathToFileURL(outputPath).href);
        runtime.configure({ output: (value) => console.log(value) });
        let failures = 0;
        const seenTests = new Set();
        for (const test of program.__langoTests ?? []) {
            if (seenTests.has(test.run)) continue;
            seenTests.add(test.run);
            try {
                program.__langoResetTests?.();
                runtime.configure({ output: (value) => console.log(value) });
                test.run();
                console.log(`PASS ${test.name}`);
            } catch (error) {
                failures += 1;
                console.error(`FAIL ${test.name}: ${displayError(error)}`);
            }
        }
        if (failures) process.exitCode = 1;
    } catch (error) {
        console.error(displayError(error));
        process.exitCode = error instanceof LangoError ? 1 : 2;
    }
} else if (command === "format" && inputPath && rest.length === 0) {
    try {
        const input = path.resolve(inputPath);
        const source = await readFile(input, "utf8");
        await writeFile(input, formatSource(source, input), "utf8");
    } catch (error) {
        console.error(displayError(error));
        process.exitCode = error instanceof LangoError ? 1 : 2;
    }
} else {
    console.error("Usage: node src/cli.mjs build <input.lango> --out <output.mjs>\n       node src/cli.mjs run <input.lango> [args...]\n       node src/cli.mjs test <input.lango>\n       node src/cli.mjs format <input.lango>");
    process.exitCode = 2;
}
