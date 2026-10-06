import assert from "node:assert/strict";
import { compile } from "../src/compiler.mjs";
import { RUNTIME_SOURCE } from "../src/runtime.mjs";
import test from "node:test";

test("Faz 53 resets dynamic context when the runtime is configured", () => {
    assert.match(RUNTIME_SOURCE, /contexts\.clear\(\)/);
});

test("Faz 53 emits global initialization reset for every Lango test", () => {
    const output = compile(`global count = 0

test
    global count
    count = count + 1
    assert count == 1
`, "sample.lango", [], true).javascript;
    assert.match(output, /export function __langoResetTests/);
    assert.match(output, /count = 0;/);
});

test("Faz 53 also resets static class values", () => {
    const output = compile(`class Counter
    static
        count = 0

test
    assert true
`, "sample.lango", [], true).javascript;
    assert.match(output, /Counter\.count = 0;/);
});

test("Faz 53 keeps the asserted source expression in failure output", () => {
    const output = compile(`test
    assert false
`, "sample.lango", [], true).javascript;
    assert.match(output, /line 2: false/);
});
