import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 175 preserves optional access when lowering array helpers", () => {
    const output = compile(`main(args)
    removed = args[0]?.remove("Ada")
    return removed
`).javascript;
    assert.match(output, /optional as __optional/);
    assert.match(output, /__optional\(__normalize\(args\[0\]\), \(value\) => __remove\(value, "Ada"\)\)/);
});

test("Faz 175 skips optional array mutations on null and runs them otherwise", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase175-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    removed = args[0]?.remove("Ada")
    cleared = args[1]?.clear()
    return [removed, cleared]
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    const hostItems = ["Ada"];
    assert.deepEqual(program.main([hostItems, null]), [true, null]);
    assert.deepEqual(hostItems, []);
});
