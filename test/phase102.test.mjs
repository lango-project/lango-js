import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildFile, compile, LangoError } from "../src/compiler.mjs";

test("Faz 102 permits a JavaScript namespace call as a statement", () => {
    const output = compile(`import js "node:fs" as fs

main(args)
    fs/promises/readFile("input.txt")
`).javascript;
    assert.match(output, /fs\.promises\.readFile\("input\.txt"\)/);
});

test("Faz 102 still validates Decimal arguments in namespace statements", () => {
    assert.throws(
        () => compile(`import js "node:fs" as fs

main(args)
    $offset = 12.50
    fs/promises/readFile("input.txt", $offset)
`),
        (error) => error instanceof LangoError && error.code === "LNG1252",
    );
});

test("Faz 102 namespace-statement conformance fixture builds", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase102-example-"));
    await buildFile(
        path.resolve("examples/102-namespace-statement/input.lango"),
        path.join(directory, "main.mjs"),
    );
});
