import assert from "node:assert/strict";
import { buildFile, compile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 40 allows a closure to read an inherited context", async () => {
    assert.doesNotThrow(
        () => compile(`main(args)
    context tenant = "Ada"
    callback = ()
        println(tenant)
`),
    );

    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase40-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/040-closure-context/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["Ada"]);
});
