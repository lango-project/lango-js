import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 127 lowers native remainder with multiplicative precedence", () => {
    const output = compile(`main(args)
    return 10 % 4 + 1
`).javascript;
    assert.match(output, /__finite\(__finite\(10 % 4\) \+ 1\)/);
});

test("Faz 127 lowers Decimal remainder through the Decimal backend", () => {
    const output = compile(`main(args)
    return $10 % $3
`).javascript;
    assert.match(output, /__decimal\("10"\)\.mod\(__decimal\("3"\)\)/);
});

test("Faz 127 retains precision for Decimal remainder", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase127-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return $9007199254740993 % $10 == $3
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), true);
});
