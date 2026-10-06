import assert from "node:assert/strict";
import { buildFile, compile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 44 validates JSON helper arity and reports malformed JSON", async () => {
    assert.throws(
        () => compile(`main(args)
    from_json()
`),
        /LNG1219.*from_json expects 1 argument/,
    );

    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase44-"));
    const inputPath = path.join(directory, "input.lango");
    const outputPath = path.join(directory, "main.mjs");
    await (await import("node:fs/promises")).writeFile(inputPath, `export main(args)

main(args)
    from_json("{")
`);
    await buildFile(inputPath, outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    runtime.configure({ output: () => {} });
    assert.throws(() => program.main([]), /JsonParseError/);
});
