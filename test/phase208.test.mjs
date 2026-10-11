import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 208 rejects dynamic JavaScript values in unary numeric negation", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase208-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return -args[0]
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.throws(() => program.main(["2"]), /NumberRequired/);
    assert.equal(program.main([2]), -2);
});
