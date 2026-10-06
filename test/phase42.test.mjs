import assert from "node:assert/strict";
import { buildFile, compile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 42 gives closures explicit access to a shared global", async () => {
    assert.throws(
        () => compile(`global count = 0

make_increment()
    return ()
        count = count + 1
        return count
`),
        /LNG1218.*declare global count first/,
    );

    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase42-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/042-closure-global/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["1", "2"]);
});
