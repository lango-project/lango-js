import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 154 lowers postfix updates for properties and Decimal bindings", () => {
    const output = compile(`main(args)
    state = { count: 1 }
    state.count++
    state.count--
    $price = $2
    $price++
    return state.count
`).javascript;
    assert.match(output, /state\.count = __finite\(__normalize\(state\.count\) \+ 1\);/);
    assert.match(output, /state\.count = __finite\(__normalize\(state\.count\) - 1\);/);
    assert.match(output, /\$price = \$price\.plus\(__decimal\("1"\)\);/);
});

test("Faz 154 updates ordinary and Decimal property targets", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase154-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    state = { count: 1 }
    state.count++
    state.count--
    $price = $2
    $price++
    $price--
    return [state.count, $price]
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    const [count, price] = program.main([]);
    assert.equal(count, 1);
    assert.equal(price.toString(), "2");
});
