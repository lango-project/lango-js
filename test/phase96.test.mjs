import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile, LangoError } from "../src/compiler.mjs";

test("Faz 96 lowers a dollar local binding through the embedded Decimal runtime", () => {
    const output = compile(`export main(args)

main(args)
    $price = 12.50
    $total = $price + 1
    return null
`).javascript;
    assert.match(output, /decimal as __decimal/);
    assert.match(output, /let \$price = __decimal\("12\.50"\);/);
    assert.match(output, /let \$total = \$price\.plus\(__decimal\("1"\)\);/);
});

test("Faz 96 Decimal conformance fixture runs with six-place division", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase96-example-"));
    const output = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/096-decimals/input.lango"), output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const values = [];
    runtime.configure({ output: (value) => values.push(value) });
    program.main([]);
    assert.deepEqual(values, ["3.333333"]);
});

test("Faz 96 executes Decimal addition with the embedded backend", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase96-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    $price = 12.50
    $total = $price + 1
    println($total)
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const values = [];
    runtime.configure({ output: (value) => values.push(value) });
    program.main([]);
    assert.deepEqual(values, ["13.5"]);
});

test("Faz 96 applies the default six-place Decimal division profile", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase96-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    $ten = 10
    $third = $ten / 3
    println($third)
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const values = [];
    runtime.configure({ output: (value) => values.push(value) });
    program.main([]);
    assert.deepEqual(values, ["3.333333"]);
});

test("Faz 96 converts Decimal to a JavaScript number only explicitly", () => {
    const output = compile(`export main(args)

main(args)
    $price = 12.50
    value = to_js_number($price)
    return value
`).javascript;
    assert.match(output, /toJsNumber as __toJsNumber/);
    assert.match(output, /__toJsNumber\(\$price\)/);
});

test("Faz 96 uses numeric equality for a Decimal binding", () => {
    const output = compile(`export main(args)

main(args)
    $price = 12.50
    return $price == 12.5
`).javascript;
    assert.match(output, /\$price\.eq\(__decimal\("12\.5"\)\)/);
    const reverse = compile(`export main(args)

main(args)
    $price = 12.50
    return 12.5 == $price
`).javascript;
    assert.match(reverse, /__decimal\("12\.5"\)\.eq\(\$price\)/);
});

test("Faz 96 lowers dollar object fields as Decimal values", () => {
    const output = compile(`export main(args)

main(args)
    data = {
        $price: 12.50
    }
    return data.$price
`).javascript;
    assert.match(output, /"\$price": __decimal\("12\.50"\)/);
    assert.match(output, /return data\.\$price;/);
});

test("Faz 96 serializes Decimal as a JSON number", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase96-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    $price = 12.50
    println(to_json($price))
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const values = [];
    runtime.configure({ output: (value) => values.push(value) });
    program.main([]);
    assert.deepEqual(values, ["12.5"]);
});

test("Faz 96 converts dollar JSON fields to Decimal", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase96-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    data = from_json('{"$price": 12.50}')
    println(data.$price + 1)
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const values = [];
    runtime.configure({ output: (value) => values.push(value) });
    program.main([]);
    assert.deepEqual(values, ["13.5"]);
});

test("Faz 96 converts a dollar parameter at function entry", () => {
    const output = compile(`export main(args)

add($amount)
    return $amount + 1

main(args)
    return add(2)
`).javascript;
    assert.match(output, /\$amount = __decimal\(\$amount\);/);
});

test("Faz 96 lowers a private Decimal instance property", () => {
    const output = compile(`class Product

Product()
    @$price = 12.50
`).javascript;
    assert.match(output, /this\.\#\$price = __decimal\("12\.50"\);/);
});

test("Faz 96 lowers a public Decimal instance property", () => {
    const output = compile(`class Product
    properties
        $price

Product()
    @$price = 12.50
`).javascript;
    assert.match(output, /\$price;/);
    assert.match(output, /this\.\$price = __decimal\("12\.50"\);/);
});

test("Faz 96 lowers a Decimal global", () => {
    const output = compile(`global $rate = 1.25

export main(args)

main(args)
    global $rate
    return $rate
`).javascript;
    assert.match(output, /let \$rate = __decimal\("1\.25"\);/);
});

test("Faz 96 accepts a Decimal static declaration and property spelling", () => {
    assert.doesNotThrow(() => compile(`class Rates
    static
        $tax = 1.25

Rates::read()
    return @@$tax
`));
});

test("Faz 96 promotes a native number when Decimal is on the right", () => {
    const output = compile(`export main(args)

main(args)
    $price = 12.50
    $total = 1 + $price
    return $total
`).javascript;
    assert.match(output, /let \$total = __decimal\("1"\)\.plus\(\$price\);/);
});

test("Faz 96 converts a JavaScript property value on dollar assignment", () => {
    const output = compile(`export main(args)

main(args)
    data = {
        price: 12.50
    }
    $price = data.price
    return $price
`).javascript;
    assert.match(output, /let \$price = __decimal\(__normalize\(data\.price\)\);/);
});

test("Faz 96 requires direct Decimal function returns to be consistent", () => {
    assert.throws(
        () => compile(`price(flag)
    $amount = 1.25
    if flag
        return $amount
      else
          return 0
`),
        (error) => error instanceof LangoError && error.code === "LNG1243",
    );
});

test("Faz 96 requires a Decimal function result to enter a dollar binding", () => {
    assert.throws(
        () => compile(`price()
    $amount = 1.25
    return $amount

main(args)
    amount = price()
    return null
`),
        (error) => error instanceof LangoError && error.code === "LNG1244",
    );
});

test("Faz 96 infers Decimal returns through a known function call", () => {
    assert.throws(
        () => compile(`price()
    $amount = 1.25
    return $amount

total()
    return price()

main(args)
    amount = total()
    return null
`),
        (error) => error instanceof LangoError && error.code === "LNG1244",
    );
});

test("Faz 96 requires a dollar parameter for a Decimal argument", () => {
    assert.throws(
        () => compile(`show(value)
    return value

main(args)
    $price = 1.25
    return show($price)
`),
        (error) => error instanceof LangoError && error.code === "LNG1245",
    );
});
