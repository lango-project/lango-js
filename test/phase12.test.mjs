import assert from "node:assert/strict";
import { compile, buildFile, LangoError } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const source = `class Color
    enum
        White = "white"
        Black = "black"

Color:default()
    return @@White

export main(args)

main(args)
    color = new Color()
    println(Color.Black)
    println(color.default())
`;

test("Faz 12 emits enum values as readonly Lango static values", () => {
    const output = compile(source).javascript;
    assert.match(output, /static White = "white";/);
    assert.match(output, /static Black = "black";/);
    assert.match(output, /return Color\.White;/);
});

test("Faz 12 rejects assignment to an enum value", () => {
    const invalid = source.replace("return @@White", "@@White = \"changed\"");
    assert.throws(() => compile(invalid), (error) => error instanceof LangoError && error.code === "LNG1204");
});

test("Faz 12 enum values fixture runs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase12-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/012-enum-values/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["black", "white"]);
});
