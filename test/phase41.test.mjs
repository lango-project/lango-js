import assert from "node:assert/strict";
import { buildFile, compile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 41 emits a file global with explicit function access", async () => {
    const source = `global surprise = 10

add(value)
    global surprise
    surprise = surprise + value
    return surprise
`;
    const output = compile(source).javascript;
    assert.match(output, /let surprise = 10;/);
    assert.doesNotMatch(output, /let surprise = surprise \+ value;/);

    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase41-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/041-globals/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const values = [];
    runtime.configure({ output: (value) => values.push(value) });
    program.main([]);
    assert.deepEqual(values, ["15", "17"]);
});

test("Faz 41 requires an explicit declaration for global mutation", () => {
    assert.throws(
        () => compile(`global surprise = 10

add(value)
    surprise = surprise + value
`),
        /LNG1218.*declare global surprise first/,
    );
});
