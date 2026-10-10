import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 153 lowers compound assignments and decrement", () => {
    const output = compile(`main(args)
    count = 8
    count -= 2
    count *= 3
    count--
    return count
`).javascript;
    assert.match(output, /count = __finite\(count - 2\);/);
    assert.match(output, /count = __finite\(count \* 3\);/);
    assert.match(output, /count = __finite\(count - 1\);/);
});

test("Faz 153 updates native, property, and Decimal bindings", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase153-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    count = 8
    count -= 2
    count *= 3
    count--
    state = { count: 4 }
    state.count += count
    $price = $2
    $price **= $3
    return [state.count, $price]
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    const [count, price] = program.main([]);
    assert.equal(count, 21);
    assert.equal(price.toString(), "8");
});
