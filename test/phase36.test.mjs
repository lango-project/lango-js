import assert from "node:assert/strict";
import { buildFile, compile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 36 mutates the shared captured local binding", async () => {
    const source = `make_counter()
    count = 0
    increment = ()
        capture count
        count = count + 1
        return count
    return increment
`;
    assert.doesNotMatch(compile(source).javascript, /let count = count \+ 1;/);

    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase36-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/036-shared-capture/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["1", "2"]);
});
