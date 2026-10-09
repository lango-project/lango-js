import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 116 distinguishes colon parameters from PostgreSQL double-colon casts", () => {
    const output = compile(`main(args)
    rs = SQL
        select :amount::numeric as amount
    rs.amount = 12.5
    return rs
`).javascript;
    assert.match(output, /__query\("select :amount::numeric as amount", \["amount"\]\)/);
});

test("Faz 116 does not treat a cast type as an assignable SQL parameter", () => {
    assert.throws(
        () => compile(`main(args)
    rs = SQL
        select :amount::numeric as amount
    rs.numeric = "ignored"
`),
        (error) => error instanceof LangoError && error.code === "LNG1256",
    );
});
