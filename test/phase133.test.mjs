import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 133 lowers not in as negated membership", () => {
    const output = compile(`main(args)
    return "x" not in ["a", "b"]
`).javascript;
    assert.match(output, /return !__includes\("x", \["a", "b"\]\);/);
});

test("Faz 133 supports negated membership for arrays and strings", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase133-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return 4 not in [1, 2, 3] and "zz" not in "lango"
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), true);
});
