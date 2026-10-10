import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 162 lowers range calls to the runtime iterator", () => {
    const output = compile(`main(args)
    for range(0, 3) as index
        println(index)
`).javascript;
    assert.match(output, /range as __range/);
    assert.match(output, /for \(const index of __range\(0, 3\)\)/);
});

test("Faz 162 iterates an end-exclusive integer range", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase162-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    total = 0
    for range(1, 5) as value
        total += value
    return total
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), 10);
});
