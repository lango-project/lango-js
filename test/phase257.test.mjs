import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

async function program(source, profile = {}) {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-numeric-add-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, source);
    await buildFile(input, output, new Set(), false, profile);
    return import(pathToFileURL(output).href);
}

for (const target of ["node", "browser"])
test(`${target} addition rejects strings and other nonnumeric operands without coercion`, async () => {
    const module = await program(`export sum(left, right)

sum(left, right)
    return left + right
`, { target });
    assert.equal(module.sum(2, 3), 5);
    for (const value of ["2", "", true, false, null, undefined, [], {}, 2n]) {
        assert.throws(() => module.sum(value, 1), /NumberRequired/);
        assert.throws(() => module.sum(1, value), /NumberRequired/);
    }
    assert.throws(() => module.sum("a", "b"), /NumberRequired/);
    let coerced = false;
    assert.throws(() => module.sum({ valueOf() { coerced = true; return 2; } }, 1), /NumberRequired/);
    assert.equal(coerced, false);
    assert.throws(() => module.sum(Number.MAX_VALUE, Number.MAX_VALUE), /NonFiniteNumber/);
});

test("compound additions reject strings in local, property and indexed targets", async () => {
    const module = await program(`export local(value)
export property(state)
export indexed(items)

local(value)
    value += 1
    return value

property(state)
    state.value += 1
    return state.value

indexed(items)
    items[0] += 1
    return items[0]
`);
    assert.equal(module.local(2), 3);
    assert.equal(module.property({ value: 2 }), 3);
    assert.equal(module.indexed([2]), 3);
    assert.throws(() => module.local("2"), /NumberRequired/);
    const state = { value: "2" };
    const items = ["2"];
    assert.throws(() => module.property(state), /NumberRequired/);
    assert.throws(() => module.indexed(items), /NumberRequired/);
    assert.equal(state.value, "2");
    assert.equal(items[0], "2");
});

test("Decimal addition keeps exact promotion but rejects implicit string conversion", async () => {
    const module = await program(`export sum(value)
export reversed(value)
export assigned(value)
export explicit(value)
export compound(value)

sum(value)
    return $9007199254740993 + value

reversed(value)
    return value + $9007199254740993

assigned(value)
    $result = value + 1
    $result += 1
    return $result

explicit(value)
    return $1 + $(value)

compound(value)
    $result = $1
    $result += value
    return $result
`);
    assert.equal(module.sum(1).toFixed(), "9007199254740994");
    assert.equal(module.reversed(1).toFixed(), "9007199254740994");
    assert.equal(module.assigned(1).toFixed(), "3");
    assert.equal(module.explicit("2").toFixed(), "3");
    assert.equal(module.compound(2).toFixed(), "3");
    for (const value of ["2", true, null, [], {}]) {
        assert.throws(() => module.sum(value), /NumberRequired/);
        assert.throws(() => module.reversed(value), /NumberRequired/);
        assert.throws(() => module.assigned(value), /NumberRequired/);
        assert.throws(() => module.compound(value), /NumberRequired/);
    }
});

test("addition evaluates operands once in source order and interpolation still composes strings", async () => {
    const module = await program(`export sum(left, right)
export text(left, right)

sum(left, right)
    return left() + right()

text(left, right)
    return "\${left}\${right}"
`);
    const calls = [];
    assert.equal(module.sum(() => { calls.push("left"); return 2; }, () => { calls.push("right"); return 3; }), 5);
    assert.deepEqual(calls, ["left", "right"]);
    assert.equal(module.text("hello", " world"), "hello world");
    assert.equal(module.text("value=", 3), "value=3");
});
