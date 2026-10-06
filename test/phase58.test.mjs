import assert from "node:assert/strict";
import { compile, LangoError } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 58 allows excess arguments for known Lango functions", () => {
    assert.doesNotThrow(() => compile(`echo(value)
    return value

main(args)
    println(echo("ok", "ignored"))
`));
});

test("Faz 58 checks each required parameter at its own position", () => {
    assert.throws(
        () => compile(`format(prefix = "#", value)
    return value

main(args)
    println(format())
`),
        (error) => error instanceof LangoError && error.code === "LNG1203" && /argument 2/.test(error.message),
    );
    assert.doesNotThrow(() => compile(`format(prefix = "#", value)
    return value

main(args)
    println(format("!", "ok", "ignored"))
`));
});
