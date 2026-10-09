import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../src/compiler.mjs";

test("Faz 121 uses parentheses to group arithmetic expressions", () => {
    const output = compile(`main(args)
    return (1 + 2) * 3
`).javascript;
    assert.match(output, /return __finite\(__finite\(1 \+ 2\) \* 3\)/);
});

test("Faz 121 permits a grouped expression as a function argument", () => {
    assert.doesNotThrow(() => compile(`main(args)
    return to_json((1 + 2) * 3)
`));
});
