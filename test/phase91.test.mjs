import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 91 keeps inherited enum values readonly", () => {
    assert.throws(
        () => compile(`class Color
    enum
        White = "white"

class Theme : Color

Theme::change()
    @@White = "black"
`),
        (error) => error instanceof LangoError && error.code === "LNG1204",
    );
});
