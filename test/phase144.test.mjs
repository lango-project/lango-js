import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 144 lowers optional bracket access with null normalization", () => {
    const output = compile(`main(args)
    return items?.[0]?.name
`).javascript;
    assert.match(output, /return __normalize\(items\?\.\[0\]\?\.name\);/);
});

test("Faz 144 returns null for an absent optional indexed receiver", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase144-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return args[0]?.[0]?.name
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([null]), null);
    assert.equal(program.main([[{ name: "Ada" }]]), "Ada");
});
