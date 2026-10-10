import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 151 lowers indexed function and method results", () => {
    const output = compile(`main(args)
    return find_items(args)?.[position] ?? source.get_items()?.[position]

find_items(args)
    return args
`).javascript;
    assert.match(output, /find_items\(args\)\?\.\[position\]/);
    assert.match(output, /__normalize\(source\.get_items\(\)\)\?\.\[position\]/);
});

test("Faz 151 supports safe indexing after function and method results", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase151-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return find_items(args[0])?.[args[1]] ?? args[2].get_items()?.[args[1]] ?? "unknown"

find_items(items)
    return items
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([["Ada"], 0, { get_items() { return ["Lin"]; } }]), "Ada");
    assert.equal(program.main([null, 0, { get_items() { return ["Lin"]; } }]), "Lin");
    assert.equal(program.main([null, 1, { get_items() { return []; } }]), "unknown");
});
