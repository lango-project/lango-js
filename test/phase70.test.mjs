import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile, compile, LangoError } from "../src/compiler.mjs";

test("Faz 70 imports a JavaScript module as a namespace", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase70-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `import js "node:path" as path

export basename(value)

basename(value)
    return path.basename(value)
`);
    await buildFile(input, output);
    const emitted = await (await import("node:fs/promises")).readFile(output, "utf8");
    assert.match(emitted, /import \* as path from "node:path";/);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.basename("/tmp/demo.txt"), "demo.txt");
});

test("Faz 70 rejects duplicate JavaScript namespace imports", () => {
    assert.throws(
        () => compile(`import js "node:path" as path
import js "node:url" as path
`),
        (error) => error instanceof LangoError && error.code === "LNG1122",
    );
});

test("Faz 70 rejects a JavaScript namespace that conflicts with Lango", () => {
    assert.throws(
        () => compile(`import js "node:path" as path

path(value)
    return value
`),
        (error) => error instanceof LangoError && error.code === "LNG1123",
    );
});
