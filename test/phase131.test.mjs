import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 131 lowers null coalescing to JavaScript ??", () => {
    const output = compile(`main(args)
    return null ?? "fallback"
`).javascript;
    assert.match(output, /return null \?\? "fallback";/);
});

test("Faz 131 returns the fallback only for null", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase131-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return args[0] ?? "fallback"
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), "fallback");
    assert.equal(program.main([false]), false);
});
