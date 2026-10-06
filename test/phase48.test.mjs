import assert from "node:assert/strict";
import { buildFile, compile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 48 emits until and unqualified loops", async () => {
    const output = compile(`main(args)
    loop
        break
`).javascript;
    assert.match(output, /while \(true\)/);

    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase48-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/048-loop-until/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const values = [];
    runtime.configure({ output: (value) => values.push(value) });
    program.main([]);
    assert.deepEqual(values, ["0", "1", "2"]);
});
