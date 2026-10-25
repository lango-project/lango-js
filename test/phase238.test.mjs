import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 238 exports an arbitrary Lango function", () => {
    const output = compile(`export topla(input)

topla(input)
    return input.a + input.b
`).javascript;
    assert.match(output, /export function topla\(input\)/);
});

test("Faz 238 exposes an exported function to a JavaScript host", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase238-"));
    const input = path.join(directory, "math.lango");
    const output = path.join(directory, "math.mjs");
    await writeFile(input, `export topla(input)

topla(input)
    return input.a + input.b
`);
    await buildFile(input, output);
    const module = await import(pathToFileURL(output).href);
    assert.equal(module.topla({ a: 2, b: 3 }), 5);
});
