import assert from "node:assert/strict";
import { compile, LangoError } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 221 relates duplicate declarations to their first location", () => {
    assert.throws(
        () => compile(`same()
    return null

same()
    return null
`, "duplicates.lango"),
        (error) => {
            assert.ok(error instanceof LangoError);
            assert.equal(error.code, "LNG1201");
            assert.deepEqual(error.related, [{
                message: "first function name same declaration",
                span: {
                    start: { line: 1, column: 1 },
                    end: { line: 1, column: 1 },
                },
            }]);
            return true;
        },
    );
});
