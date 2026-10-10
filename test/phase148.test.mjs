import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 148 lowers chained optional index access", () => {
    const output = compile(`main(args)
    return matrix?.[row]?.[column]
`).javascript;
    assert.match(output, /return __normalize\(__normalize\(matrix\?\.\[row\]\)\?\.\[column\]\);/);
});

test("Faz 148 returns null when either optional indexed receiver is absent", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase148-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return args[0]?.[0]?.[0] ?? "unknown"
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([null]), "unknown");
    assert.equal(program.main([[]]), "unknown");
    assert.equal(program.main([[["Ada"]]]), "Ada");
});
