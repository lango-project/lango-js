import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 126 lowers != to strict JavaScript inequality", () => {
    const output = compile(`main(args)
    return 1 != 2
`).javascript;
    assert.match(output, /return 1 !== 2;/);
});

test("Faz 126 lowers Decimal inequality through Decimal equality", () => {
    const output = compile(`main(args)
    return ($1 + $2) != ($3 + $0)
`).javascript;
    assert.match(output, /!\([^\n]+\.eq\([^\n]+\)\)/);
});

test("Faz 126 retains precision for compound Decimal inequality", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase126-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return ($9007199254740993 + $1) != ($9007199254740994 + $0)
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), false);
});
