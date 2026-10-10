import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 156 lowers multidimensional indexed updates", () => {
    const output = compile(`main(args)
    matrix = [[1]]
    row = 0
    column = 0
    matrix[row][column] = 3
    matrix[row][column] += 2
    matrix[row][column]--
    return matrix[row][column]
`).javascript;
    assert.match(output, /matrix\[row\]\[column\] = 3;/);
    assert.match(output, /matrix\[row\]\[column\] = __finite\(matrix\[row\]\[column\] \+ 2\);/);
    assert.match(output, /matrix\[row\]\[column\] = __finite\(matrix\[row\]\[column\] - 1\);/);
});

test("Faz 156 updates a multidimensional collection target", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase156-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    matrix = [[1]]
    row = 0
    column = 0
    matrix[row][column] = 3
    matrix[row][column] += 2
    matrix[row][column]--
    return matrix[row][column]
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), 4);
});
