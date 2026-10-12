import assert from "node:assert/strict";
import { diagnose } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 232 diagnoses an else aligned with its if", () => {
    const diagnostics = diagnose("main(args)\n    if true\n        println(\"then\")\n    else\n        println(\"else\")\n", "misaligned-else.lango");
    assert.deepEqual(
        diagnostics.map((diagnostic) => ({
            code: diagnostic.code,
            line: diagnostic.span.start.line,
        })),
        [{
            code: "LNG1110",
            line: 4,
        }],
    );
});
