import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 163 accepts an optional range step and validates arity", () => {
    const output = compile(`main(args)
    for range(10, 0, -2) as value
        println(value)
`).javascript;
    assert.match(output, /__range\(10, 0, __finite\(-2\)\)/);
    assert.throws(
        () => compile(`main(args)
    return range()
`),
        (error) => error.code === "LNG1219",
    );
});

test("Faz 163 iterates stepped ascending and descending ranges", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase163-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    total = 0
    for range(10, 0, -2) as value
        total += value
    for range(1, 6, 2) as value
        total += value
    return total
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), 39);
});
