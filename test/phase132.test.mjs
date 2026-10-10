import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 132 lowers membership through the runtime helper", () => {
    const output = compile(`main(args)
    return "a" in ["a", "b"]
`).javascript;
    assert.match(output, /includes as __includes/);
    assert.match(output, /__includes\("a", \["a", "b"\]\)/);
});

test("Faz 132 supports membership in arrays and strings", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase132-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return 2 in [1, 2, 3] and "an" in "lango"
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), true);
});
