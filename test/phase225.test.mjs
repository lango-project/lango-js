import assert from "node:assert/strict";
import { compile, diagnose, LangoError } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 225 reports every independent TAB diagnostic", () => {
    const source = "main(args)\n\treturn null\n\t\tprintln(\"done\")\n";
    const diagnostics = diagnose(source, "tabs.lango");
    assert.equal(diagnostics.length, 3);
    assert.deepEqual(
        diagnostics.map((item) => item.span.start),
        [{ line: 2, column: 1 }, { line: 3, column: 1 }, { line: 3, column: 2 }],
    );
    assert.throws(
        () => compile(source, "tabs.lango"),
        (error) => error instanceof LangoError && error.code === "LNG1001" && error.span.start.line === 2,
    );
});
