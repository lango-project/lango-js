import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 150 lowers properties and methods after calls", () => {
    const output = compile(`main(args)
    return find_user(args)?.name ?? find_user(args)?.format()

find_user(args)
    return args[0]
`).javascript;
    assert.match(output, /find_user\(args\)\?\.name/);
    assert.match(output, /find_user\(args\)\?\.format\(\)/);
});

test("Faz 150 supports safe properties and methods after a call result", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase150-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return find_user(args)?.name ?? find_user(args)?.format() ?? "unknown"

find_user(args)
    return args[0]
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([{ name: "Ada" }]), "Ada");
    assert.equal(program.main([{ format() { return "Lin"; } }]), "Lin");
    assert.equal(program.main([null]), "unknown");
});
