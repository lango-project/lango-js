import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 158 lowers iterable expressions in value and key-value loops", () => {
    const output = compile(`main(args)
    for args[0] as item
        println(item)
    for make_object() as key: value
        println(key)

make_object()
    return { count: 3 }
`).javascript;
    assert.match(output, /for \(const item of __normalize\(args\[0\]\)\)/);
    assert.match(output, /of __entries\(make_object\(\)\)/);
});

test("Faz 158 iterates property, indexed, and call-result collections", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase158-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    total = 0
    for args[0].items[0] as item
        total += item
    for make_object() as key: value
        total += value
    return total

make_object()
    return { count: 3 }
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([{ items: [[1, 2]] }]), 6);
});
