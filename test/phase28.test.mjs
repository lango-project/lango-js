import assert from "node:assert/strict";
import { buildFile, compile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 28 emits and invokes a local closure", async () => {
    const source = `export main(args)

main(args)
    count = 7
    callback = ()
        capture count
        println(count)
    callback()
`;
    assert.match(compile(source).javascript, /let callback = \(\) =>/);

    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase28-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/028-closures/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["7"]);
});
