import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 79 calls a nested JavaScript namespace method", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase79-"));
    const textPath = path.join(directory, "message.txt");
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(textPath, "hello");
    await writeFile(input, `import js "node:fs" as fs

export read(file)

read(file)
    return fs/promises/readFile(file, "utf8")
`);
    await buildFile(input, output);
    const emitted = await (await import("node:fs/promises")).readFile(output, "utf8");
    assert.match(emitted, /fs\.promises\.readFile\(file, "utf8"\)/);
    const program = await import(pathToFileURL(output).href);
    assert.equal(await program.read(textPath), "hello");
});
