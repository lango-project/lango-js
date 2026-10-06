import assert from "node:assert/strict";
import { compile, buildFile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 11 emits class static values and @@ access", () => {
    const source = `export main(args)

class Constants
    static
        Answer = 42
    methods
        value()
        increase()

Constants:value()
    return @@Answer

Constants:increase()
    @@Answer = @@Answer + 1
    return @@Answer

main(args)
    constants = new Constants()
    println(Constants.Answer)
    println(constants.value())
    println(constants.increase())
`;
    const output = compile(source).javascript;
    assert.match(output, /static Answer = 42;/);
    assert.match(output, /return __normalize\(Constants\.Answer\);/);
    assert.match(output, /Constants\.Answer = __finite\(__normalize\(Constants\.Answer\) \+ 1\);/);
    assert.doesNotMatch(output, /#Answer/);
});

test("Faz 11 static values fixture runs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase11-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/011-static-values/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["42", "42", "43"]);
});
