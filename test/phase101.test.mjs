import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildFile, compile, LangoError } from "../src/compiler.mjs";

test("Faz 101 requires explicit Decimal conversion at JavaScript namespace boundaries", () => {
    assert.throws(
        () => compile(`import js "node:fs" as fs

main(args)
    $offset = 12.50
    value = fs/readFile("input.txt", $offset)
`),
        (error) => error instanceof LangoError && error.code === "LNG1252",
    );
    assert.doesNotThrow(() => compile(`import js "node:fs" as fs

main(args)
    $offset = 12.50
    value = fs/readFile("input.txt", to_js_number($offset))
`));
});

test("Faz 101 requires explicit Decimal conversion for JavaScript construction", () => {
    assert.throws(
        () => compile(`import js "node:buffer" as buffer

main(args)
    $size = 4
    value = new buffer/SlowBuffer($size)
`),
        (error) => error instanceof LangoError && error.code === "LNG1252",
    );
});

test("Faz 101 JavaScript-boundary conformance fixture builds", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase101-example-"));
    await buildFile(
        path.resolve("examples/101-js-boundary/input.lango"),
        path.join(directory, "main.mjs"),
    );
});
