import assert from "node:assert/strict";
import { compile, formatDiagnostics, LangoError } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 222 formats locations and related declaration diagnostics", () => {
    let error;
    try {
        compile(`same()
    return null

same()
    return null
`, "duplicates.lango");
    } catch (caught) {
        error = caught;
    }
    assert.ok(error instanceof LangoError);
    assert.equal(
        formatDiagnostics(error),
        "duplicates.lango:4:1: error LNG1201: LNG1201 at line 4: duplicate function name same\n  related duplicates.lango:1:1: first function name same declaration",
    );
});
