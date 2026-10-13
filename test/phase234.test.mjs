import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 234 accepts a multi-line object argument", () => {
    const output = compile(`main(args)
    response.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
    })
`).javascript;
    assert.match(
        output,
        /response\.writeHead\(200, \{ "Content-Type": "text\/plain; charset=utf-8" \}\)/,
    );
});

test("Faz 234 diagnoses an unterminated multi-line expression", () => {
    assert.throws(
        () => compile(`main(args)
    response.writeHead(200, {
        "Content-Type": "text/plain"
`),
        (error) => error instanceof LangoError && error.code === "LNG1262",
    );
});
