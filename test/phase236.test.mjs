import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 236 accepts a method callback closure after ordinary arguments", () => {
    const output = compile(`main(args)
    server.on("error", (error)
        println("Sunucu hatasi: \${error.message}")
        throw error
    )
`).javascript;
    assert.match(output, /server\.on\("error", __withArity\(\(error\) => \{/);
    assert.match(output, /throw error/);
});

test("Faz 236 requires the method callback closing parenthesis", () => {
    assert.throws(
        () => compile(`main(args)
    server.on("error", (error)
        throw error
`),
        (error) => error instanceof LangoError && error.code === "LNG1264",
    );
});
