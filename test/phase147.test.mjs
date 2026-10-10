import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 147 lowers chained computed indexes", () => {
    const output = compile(`main(args)
    return matrix[row + 1][column + 1]
`).javascript;
    assert.match(output, /return __normalize\(__normalize\(matrix\[__finite\(row \+ 1\)\]\)\[__finite\(column \+ 1\)\]\);/);
});

test("Faz 147 reads a nested computed array value", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase147-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    matrix = args[0]
    row = args[1]
    column = args[2]
    return matrix[row + 1][column + 1]
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([[["Ada", "Lin"], ["Maya", "Noa"]], 0, 0]), "Noa");
});
