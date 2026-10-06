import assert from "node:assert/strict";
import { compile } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 29 requires every outer closure binding to be captured", () => {
    assert.throws(
        () => compile(`main(args)
    count = 7
    callback = ()
        println(count)
`),
        /LNG1210.*MissingCapture: count/,
    );
});

test("Faz 29 rejects unused or not-yet-assigned captures", () => {
    assert.throws(
        () => compile(`main(args)
    callback = ()
        capture count
        println("ready")
`),
        /LNG1211.*unused capture count/,
    );
    assert.throws(
        () => compile(`main(args)
    callback = ()
        capture count
        println(count)
    count = 7
`),
        /LNG1212.*capture count is not assigned/,
    );
});
