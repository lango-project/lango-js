import assert from "node:assert/strict";
import { buildFile, compile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 34 retains a class for a captured static property", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase34-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/034-static-capture/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["9"]);
});

test("Faz 34 rejects malformed and duplicate capture names", () => {
    assert.throws(
        () => compile(`main(args)
    value = 1
    callback = ()
        capture value, value
        return value
`),
        /LNG1118.*duplicate capture name/,
    );
    assert.throws(
        () => compile(`main(args)
    callback = ()
        capture @@_value
        return @@_value
`),
        /LNG1117.*invalid capture list/,
    );
});
