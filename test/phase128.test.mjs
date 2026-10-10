import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 128 gives exponentiation its usual right associativity", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase128-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return 2 ** 3 ** 2
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), 512);
});

test("Faz 128 lowers Decimal exponentiation through the Decimal backend", () => {
    const output = compile(`main(args)
    return $2 ** $3
`).javascript;
    assert.match(output, /__decimal\("2"\)\.pow\(__decimal\("3"\)\)/);
});

test("Faz 128 retains precision for Decimal exponentiation", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase128-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return $10 ** $20 == $100000000000000000000
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), true);
});
