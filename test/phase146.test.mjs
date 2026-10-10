import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 146 lowers computed index expressions with null normalization", () => {
    const output = compile(`main(args)
    return items[position + 1]
`).javascript;
    assert.match(output, /return __normalize\(items\[__finite\(position \+ 1\)\]\);/);
});

test("Faz 146 supports computed indexes and optional computed access", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase146-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    items = args[0]
    position = args[1]
    return items?.[position + 1] ?? "unknown"
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([["Ada", "Lin"], 0]), "Lin");
    assert.equal(program.main([null, 0]), "unknown");
});
