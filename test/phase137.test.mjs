import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 137 rejects duplicate inline object keys", () => {
    assert.throws(
        () => compile(`main(args)
    return { name: "Ada", "name": "Lin" }
`),
        (error) => error instanceof LangoError && error.code === "LNG1258",
    );
});

test("Faz 137 rejects duplicate multiline object keys", () => {
    assert.throws(
        () => compile(`main(args)
    user = {
        name: "Ada"
        name: "Lin"
    }
    return user
`),
        (error) => error instanceof LangoError && error.code === "LNG1258",
    );
});
