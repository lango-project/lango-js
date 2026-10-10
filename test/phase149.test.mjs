import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 149 lowers properties and method calls after indexed access", () => {
    const output = compile(`main(args)
    return users[position]?.name ?? users[position]?.format()
`).javascript;
    assert.match(output, /__normalize\(users\[position\]\)\?\.name/);
    assert.match(output, /__normalize\(users\[position\]\)\?\.format\(\)/);
});

test("Faz 149 supports safe properties and methods after an index", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase149-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    users = args[0]
    position = args[1]
    return users[position]?.name ?? users[position]?.format() ?? "unknown"
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([[{ name: "Ada" }], 0]), "Ada");
    assert.equal(program.main([[{ format() { return "Lin"; } }], 0]), "Lin");
    assert.equal(program.main([[], 0]), "unknown");
});
