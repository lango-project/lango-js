import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../src/compiler.mjs";

test("Faz 237 accepts kebab-case locals and functions", () => {
    const output = compile(`topla-fiyat(a, b)
    return a + b

main(args)
    toplam-fiyat = topla-fiyat(2, 3)
    return toplam-fiyat
`).javascript;
    assert.match(output, /function topla__lango_dash__fiyat/);
    assert.match(output, /let toplam__lango_dash__fiyat/);
});

test("Faz 237 emits kebab-case object members as JavaScript string keys", () => {
    const output = compile(`main(args)
    style = { font-size: "14px" }
    return style.font-size
`).javascript;
    assert.match(output, /"font-size": "14px"/);
    assert.match(output, /style\["font-size"\]/);
});
