import assert from "node:assert/strict";
import { diagnose } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 226 groups independent class declaration diagnostics", () => {
    const diagnostics = diagnose(`class Broken : Missing
    properties
        value
        value
    static
        ready = true
    enum
        ready = false

class AlsoBroken
    methods
        missing()
`, "classes.lango");
    assert.deepEqual(
        diagnostics.map((diagnostic) => diagnostic.code),
        ["LNG1206", "LNG1225", "LNG1224", "LNG1209"],
    );
    assert.ok(diagnostics.every((diagnostic) => diagnostic.sourceName === "classes.lango"));
});
