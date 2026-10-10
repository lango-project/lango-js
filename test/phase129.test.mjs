import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 129 lowers arithmetic with compound Decimal operands through the backend", () => {
    const output = compile(`main(args)
    return ($1 + $2) * ($3 + $4)
`).javascript;
    assert.match(output, /\.plus\([^\n]+\)\.times\([^\n]+\.plus\(/);
});

test("Faz 129 retains precision for arithmetic with compound Decimal operands", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase129-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return ($9007199254740993 + $1) * ($2 + $3) == $45035996273704970
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), true);
});
