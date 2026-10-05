import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 8 throw, catch, and finally run", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase8-"));
    const sourcePath = path.join(directory, "input.lango");
    const outputPath = path.join(directory, "main.mjs");
    await writeFile(sourcePath, "export main(args)\n\nmain(args)\n    try\n        throw 'failed'\n    catch err\n        println(err)\n    finally\n        println('done')\n");
    await buildFile(sourcePath, outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["failed", "done"]);
});
