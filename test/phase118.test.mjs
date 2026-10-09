import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 118 does not parse an operator inside a string literal", () => {
    const output = compile(`main(args)
    return "a + b"
`).javascript;
    assert.match(output, /return "a \+ b"/);
});

test("Faz 118 parses an operator inside a function argument", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase118-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return to_json($1 / $3)
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), "0.333333");
});
