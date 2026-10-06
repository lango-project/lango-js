import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../src/compiler.mjs";

test("Faz 96 lowers a dollar local binding through the embedded Decimal runtime", () => {
    const output = compile(`export main(args)

main(args)
    $price = 12.50
    $total = $price + 1
    return null
`).javascript;
    assert.match(output, /decimal as __decimal/);
    assert.match(output, /let \$price = __decimal\("12\.50"\);/);
    assert.match(output, /let \$total = __decimal\(\$price\.plus\(__decimal\("1"\)\)\);/);
});
