import assert from "node:assert/strict";
import { compile } from "../src/compiler.mjs";
import test from "node:test";

const source = `add(a, b)
    return a + b

test "addition"
    assert add(3, 5) == 8

test
    assert true
`;

test("Faz 52 excludes Lango tests from production output", () => {
    const output = compile(source).javascript;
    assert.doesNotMatch(output, /__langoTests/);
    assert.doesNotMatch(output, /__assert/);
});

test("Faz 52 emits discoverable synchronous Lango tests on demand", () => {
    const output = compile(source, "sample.lango", [], true).javascript;
    assert.match(output, /export const __langoTests/);
    assert.match(output, /name: "addition"/);
    assert.match(output, /assert as __assert/);
});
