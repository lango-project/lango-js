import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 124 lowers Decimal relational comparisons through the Decimal backend", () => {
    const output = compile(`main(args)
    return $10 <= 10 and 9 < $10
`).javascript;
    assert.match(output, /__decimal\("10"\)\.lte\(__decimal\("10"\)\)/);
    assert.match(output, /__decimal\("10"\)\.gt\(__decimal\("9"\)\)/);
});

test("Faz 124 retains precision for a Decimal comparison beyond Number precision", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase124-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    $large = $9007199254740993
    return $large > 9007199254740992
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), true);
});
