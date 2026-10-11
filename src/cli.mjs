#!/usr/bin/env node
import path from "node:path";
import os from "node:os";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { buildFile, formatSource, LangoError } from "./compiler.mjs";
import { createSqliteAdapter } from "./database.mjs";
import { Decimal } from "./runtime.mjs";

const [command, inputPath, ...rest] = process.argv.slice(2);
const displayError = (error) => error instanceof LangoError && error.diagnostics
    ? error.diagnostics.map((item) => item.message).join("\n")
    : error instanceof Error ? error.message : error;
const buildOptions = (arguments_) => {
    if (arguments_[0] !== "--out" || !arguments_[1]) return null;
    const profile = {};
    for (let index = 2; index < arguments_.length; index += 2) {
        const option = arguments_[index];
        const value = arguments_[index + 1];
        if (!value) return null;
        if (option === "--decimal-division-scale")
            profile.decimal_division_scale = Number(value);
        else if (option === "--decimal-division-rounding")
            profile.decimal_division_rounding = Decimal.Rounding[value] ?? value;
        else return null;
    }
    return { outputPath: arguments_[1], profile };
};
const build = command === "build" && inputPath ? buildOptions(rest) : null;
const runOptions = (arguments_) => {
    const options = { database: null, catalog: null };
    let index = 0;
    while (arguments_[index] === "--database" || arguments_[index] === "--catalog") {
        const option = arguments_[index];
        const value = arguments_[index + 1];
        if (!value) return null;
        if (option === "--database") options.database = value;
        else options.catalog = value;
        index += 2;
    }
    if (arguments_[index] === "--") index += 1;
    return { ...options, args: arguments_.slice(index) };
};

if (build) {
    try {
        await buildFile(path.resolve(inputPath), path.resolve(build.outputPath), new Set(), false, build.profile);
    } catch (error) {
        console.error(displayError(error));
        process.exitCode = error instanceof LangoError ? 1 : 2;
    }
} else if (command === "run" && inputPath) {
    let database = null;
    try {
        const options = runOptions(rest);
        if (!options) throw new Error("Lango run requires a database filename after --database");
        const directory = await mkdtemp(path.join(os.tmpdir(), "lango-run-"));
        const outputPath = path.join(directory, "main.mjs");
        await buildFile(path.resolve(inputPath), outputPath);
        const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
        const program = await import(pathToFileURL(outputPath).href);
        if (typeof program.main !== "function")
            throw new Error("Lango run requires an exported main(args)");
        if (options.database) database = createSqliteAdapter(path.resolve(options.database));
        const catalog = options.catalog
            ? JSON.parse(await readFile(path.resolve(options.catalog), "utf8"))
            : {};
        if (!catalog || Array.isArray(catalog) || typeof catalog !== "object")
            throw new Error("Lango run catalog must be a JSON object");
        runtime.configure({ output: (value) => console.log(value), catalog, database_adapter: database });
        await program.main(options.args);
    } catch (error) {
        console.error(displayError(error));
        process.exitCode = error instanceof LangoError ? 1 : 2;
    } finally {
        database?.close();
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
    console.error("Usage: node src/cli.mjs build <input.lango> --out <output.mjs> [--decimal-division-scale <n>] [--decimal-division-rounding <EnumName>]\n       node src/cli.mjs run <input.lango> [--database <sqlite-file>] [--catalog <catalog.json>] [-- args...]\n       node src/cli.mjs test <input.lango>\n       node src/cli.mjs format <input.lango>");
    process.exitCode = 2;
}
