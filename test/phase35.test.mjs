import assert from "node:assert/strict";
import { buildFile, compile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 35 retains a protected property in a closure", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase35-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/035-protected-capture/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["8"]);
});

test("Faz 35 rejects an unknown protected capture", () => {
    assert.throws(
        () => compile(`class Counter
    methods
        callback()

Counter:callback()
    callback = ()
        capture _value
        return _value
`),
        /LNG1214.*unknown captured property _value/,
    );
});
