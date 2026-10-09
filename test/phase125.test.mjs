import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 125 lowers compound Decimal equality through the Decimal backend", () => {
    const output = compile(`main(args)
    return ($1 + $2) == ($3 + $0)
`).javascript;
    assert.match(output, /\.plus\([^\n]+\)\.eq\(/);
});

test("Faz 125 retains precision when comparing compound Decimal expressions", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase125-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return ($9007199254740993 + $1) == ($9007199254740994 + $0)
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), true);
});
