import assert from "node:assert/strict";
import { compile } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 54 rejects unknown class property reads", () => {
    assert.throws(
        () => compile(`class Counter

Counter()
    println(@count)
`),
        /LNG1222.*unknown instance property @count/,
    );
    assert.throws(
        () => compile(`class Counter

Counter()
    println(@@count)
`),
        /LNG1221.*unknown static property @@count/,
    );
    assert.throws(
        () => compile(`class Counter

Counter()
    println(_count)
`),
        /LNG1222.*unknown protected property _count/,
    );
});

test("Faz 54 recognizes inherited public, protected, and static members", () => {
    assert.doesNotThrow(() => compile(`class Parent
    properties
        name
    static
        limit = 10

Parent()
    _code = 7

class Child : Parent

Child:read()
    return @name + _code + @@limit
`));
});
