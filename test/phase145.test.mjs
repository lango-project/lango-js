import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 145 lowers optional method calls with null normalization", () => {
    const output = compile(`main(args)
    return user?.format()
`).javascript;
    assert.match(output, /return __normalize\(user\?\.format\(\)\);/);
});

test("Faz 145 skips an optional method call for a null receiver", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase145-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    user = args[0]
    return user?.format() ?? "unknown"
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([null]), "unknown");
    assert.equal(program.main([{ format() { return "Ada"; } }]), "Ada");
});
