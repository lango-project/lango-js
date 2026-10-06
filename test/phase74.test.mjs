import assert from "node:assert/strict";
import { compile, LangoError } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 74 rejects duplicate and conflicting imported local names", () => {
    assert.throws(
        () =>
            compile(
                `main(args)
    return null
`,
                "sample.lango",
                [
                    { names: ["add as math"] },
                    { names: ["subtract as math"] },
                ],
            ),
        (error) => error instanceof LangoError && error.code === "LNG1228",
    );
    assert.throws(
        () =>
            compile(
                `helper(value)
    return value
`,
                "sample.lango",
                [{ names: ["other as helper"] }],
            ),
        (error) => error instanceof LangoError && error.code === "LNG1229",
    );
});
