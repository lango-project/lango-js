import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 81 treats a JavaScript namespace as non-callable", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase81-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `import js "node:fs" as fs

export invoke()

invoke()
    return fs()
`);
    await buildFile(input, output);
    const emitted = await (await import("node:fs/promises")).readFile(output, "utf8");
    assert.match(emitted, /__call\(fs, \)/);
    const program = await import(pathToFileURL(output).href);
    assert.throws(() => program.invoke(), /NotCallable/);
});
