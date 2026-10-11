import assert from "node:assert/strict";
import { diagnose } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 230 groups independent loop-level diagnostics", () => {
    const diagnostics = diagnose(`main(args)
    break
    loop
        continue 2

test "also invalid"
    break
`, "loops.lango");
    assert.deepEqual(
        diagnostics.map((diagnostic) => diagnostic.code),
        ["LNG1220", "LNG1220", "LNG1220"],
    );
    assert.deepEqual(
        diagnostics.map((diagnostic) => diagnostic.span.start.line),
        [2, 4, 7],
    );
    assert.ok(diagnostics.every((diagnostic) => diagnostic.sourceName === "loops.lango"));
});
