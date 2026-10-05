import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile, compile, LangoError } from "../src/compiler.mjs";

test("Faz 2 functions compile and run", async () => {
    const root = path.resolve("examples/003-functions");
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase2-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.join(root, "input.lango"), outputPath);
    assert.equal(await readFile(outputPath, "utf8"), await readFile(path.join(root, "expected.mjs"), "utf8"));
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const values = [];
    runtime.configure({ catalog: { "Hello, {0}": "Merhaba, {0}" }, output: (value) => values.push(value) });
    assert.equal(program.main(["Savaş"]), null);
    assert.deepEqual(values, ["Merhaba, Savaş"]);
});

test("Faz 2 rejects bad Lango call arity", () => {
    assert.throws(() => compile("export main(args)\n\ngreet(name)\n    return name\n\nmain(args)\n    println(greet())\n"), (error) => error instanceof LangoError && error.code === "LNG1203");
});
