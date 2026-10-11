import assert from "node:assert/strict";
import { diagnose } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 223 exposes compiler diagnostics without throwing", () => {
    assert.deepEqual(diagnose("main(args)\n    return null\n", "valid.lango"), []);
    const diagnostics = diagnose("main(args)\n    invalid statement\n", "invalid.lango");
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].code, "LNG1106");
    assert.equal(diagnostics[0].sourceName, "invalid.lango");
});
