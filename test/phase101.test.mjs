import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

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
