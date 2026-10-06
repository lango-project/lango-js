import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 83 rejects cyclic class inheritance before member analysis", () => {
    assert.throws(
        () => compile(`class First : Second

class Second : First
`),
        (error) => error instanceof LangoError && error.code === "LNG1236",
    );
});
