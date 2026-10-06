import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 97 requires a local assignment on every if path", () => {
    assert.throws(
        () => compile(`main(args)
    if true
        value = 1
    println(value)
`),
        (error) => error instanceof LangoError && error.code === "LNG1246",
    );
    assert.doesNotThrow(() => compile(`main(args)
    if true
        value = 1
      else
          value = 2
    println(value)
`));
});

test("Faz 97 does not treat a loop assignment as definite afterward", () => {
    assert.throws(
        () => compile(`main(args)
    loop while false
        value = 1
    println(value)
`),
        (error) => error instanceof LangoError && error.code === "LNG1246",
    );
});

test("Faz 97 intersects try and catch assignments, then applies finally", () => {
    assert.doesNotThrow(() => compile(`main(args)
    try
        value = 1
    catch err
        value = 2
    println(value)
`));
    assert.doesNotThrow(() => compile(`main(args)
    try
        println("try")
    finally
        value = 2
    println(value)
`));
});

test("Faz 97 applies definite assignment before a closure capture", () => {
    assert.throws(
        () => compile(`main(args)
    if true
        value = 1
    callback = ()
        capture value
        println(value)
`),
        (error) => error instanceof LangoError && error.code === "LNG1212",
    );
});

test("Faz 97 allows a closure capture assigned in both if paths", () => {
    assert.doesNotThrow(() => compile(`main(args)
    if true
        value = 1
      else
          value = 2
    callback = ()
        capture value
        println(value)
`));
});

test("Faz 97 allows a closure capture assigned in try and catch", () => {
    assert.doesNotThrow(() => compile(`main(args)
    try
        value = 1
    catch err
        value = 2
    callback = ()
        capture value
        println(value)
`));
});

test("Faz 97 hoists a branch-assigned local for emitted JavaScript scope", () => {
    const output = compile(`main(args)
    if true
        value = 1
      else
          value = 2
    println(value)
`).javascript;
    assert.match(output, /let value;[\s\S]*value = 1;[\s\S]*println\(value\)/);
});
