import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 171 lowers Array#clear to the shared array helper", () => {
    const output = compile(`main(args)
    items = ["Ada"]
    result = items.clear()
    return result
`).javascript;
    assert.match(output, /clear as __clear/);
    assert.match(output, /let result = __clear\(items\);/);
});

test("Faz 171 clears local and host-provided arrays", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase171-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    items = ["Ada", "Lin"]
    result = items.clear()
    args[0].clear()
    return [result, items]
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    const hostItems = ["Maya"];
    assert.deepEqual(program.main([hostItems]), [null, []]);
    assert.deepEqual(hostItems, []);
});
