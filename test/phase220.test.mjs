import assert from "node:assert/strict";
import { compile, LangoError } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 220 attaches the source name to semantic diagnostics", () => {
    assert.throws(
        () => compile(`main(args)
    if true
        value = 1
    return value
`, "semantic-error.lango"),
        (error) => {
            assert.ok(error instanceof LangoError);
            assert.equal(error.code, "LNG1246");
            assert.equal(error.sourceName, "semantic-error.lango");
            return true;
        },
    );
});
