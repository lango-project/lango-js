import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 155 lowers indexed assignment, compound update, and postfix update", () => {
    const output = compile(`main(args)
    items = [1, 2]
    position = 1
    items[position] = 3
    items[position] += 2
    items[position]--
    return items[position]
`).javascript;
    assert.match(output, /items\[position\] = 3;/);
    assert.match(output, /items\[position\] = __finite\(items\[position\] \+ 2\);/);
    assert.match(output, /items\[position\] = __finite\(items\[position\] - 1\);/);
});

test("Faz 155 updates an indexed collection target", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase155-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    items = [1, 2]
    position = 1
    items[position] = 3
    items[position] += 2
    items[position]--
    return items[position]
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), 4);
});
