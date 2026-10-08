import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 104 rejects static string-number coercion", () => {
    assert.throws(
        () => compile(`main(args)
    return "2" > 1
`),
        (error) => error instanceof LangoError && error.code === "LNG1254",
    );
    assert.throws(
        () => compile(`main(args)
    return "2" + 1
`),
        (error) => error instanceof LangoError && error.code === "LNG1254",
    );
    assert.throws(
        () => compile(`main(args)
    return true + 1
`),
        (error) => error instanceof LangoError && error.code === "LNG1254",
    );
    assert.throws(
        () => compile(`main(args)
    return null + 1
`),
        (error) => error instanceof LangoError && error.code === "LNG1254",
    );
});
