import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 164 lowers single-argument range from zero", () => {
    const output = compile(`main(args)
    for range(3) as value
        println(value)
`).javascript;
    assert.match(output, /for \(const value of __range\(0, 3\)\)/);
});

test("Faz 164 iterates a zero-based end-exclusive range", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase164-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    total = 0
    for range(4) as value
        total += value
    return total
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), 6);
});
