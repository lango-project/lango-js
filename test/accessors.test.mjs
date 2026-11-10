import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile, compile, diagnose, formatSource } from "../src/compiler.mjs";

const box = `export main(args)

export class Box
    properties
        value?
        value!

Box()
    @value = 0

Box:value?
    return @value

Box:value!(value)
    @value = value
`;

async function built(source, target, run, files = {}) {
    const dir = await mkdtemp(path.join(os.tmpdir(), "lango-accessors-"));
    try {
        await writeFile(path.join(dir, "package.json"), '{"type":"module"}');
        for (const [name, contents] of Object.entries(files))
            await writeFile(path.join(dir, name), contents);
        const input = path.join(dir, "input.lango");
        const output = path.join(dir, "output.mjs");
        await writeFile(input, source);
        await buildFile(input, output, new Set(), false, { target });
        const program = await import(pathToFileURL(output).href);
        await run(program);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}

for (const target of ["node", "browser"]) {
    test(`${target} accessors preserve explicit Lango markers and expose native JS descriptors`, async () => {
        const source = box + `
main(args)
    k = new Box()
    k.value! = 333
    return "Value: \${k.value?}"
`;
        assert.equal(formatSource(source), source);
        await built(source, target, async (program) => {
            assert.equal(program.main([]), "Value: 333");
            const descriptor = Object.getOwnPropertyDescriptor(program.Box.prototype, "value");
            assert.equal(typeof descriptor.get, "function");
            assert.equal(typeof descriptor.set, "function");
            assert.equal(Object.hasOwn(program.Box.prototype, "value?"), false);
            const instance = new program.Box();
            instance.value = 17;
            assert.equal(instance.value, 17);
        });
    });
}

test("host getters and ordinary JS fields support marked and unmarked access without descriptor checks", async () => {
    const source = `import js "./host.mjs" as host

export main(args)

main(args)
    object = host/create()
    object.value! = 41
    marked = object.value?
    object.value = 42
    plain = object.value
    evaluated = host/create().value?
    data = {
        value: 1
    }
    data.value! = 7
    absent = null
    return {
        marked: marked
        plain: plain
        evaluated: evaluated
        calls: host/count()
        data: data.value?
        optional: absent?.value?
    }
`;
    await built(source, "node", async (program) => {
        assert.deepEqual(program.main([]), { marked: 41, plain: 42, evaluated: 0, calls: 2, data: 7, optional: null });
    }, { "host.mjs": `let calls = 0;
export function count() { return calls; }
export function create() { calls++; return { stored: 0, get value() { return this.stored; }, set value(v) { this.stored = v; } }; }
` });
});

test("known Lango accessors reject missing markers and wrong read/write directions", () => {
    for (const statement of ["k.value? = 1", "return k.value!", "return k.value", "k.value = 1", "k.value! += 1", "k.value?++"]) {
        const errors = diagnose(box + `\nmain(args)\n    k = new Box()\n    ${statement}\n`);
        assert.equal(errors[0]?.code, "LNG1274", statement);
        assert.doesNotMatch(errors[0].message, /__lango_(get|set)__/);
    }
    const readonly = box.replace("        value!\n", "").replace("Box:value!(value)\n    @value = value\n", "");
    assert.throws(() => compile(readonly + "\nmain(args)\n    k = new Box()\n    k.value! = 1\n"), /accessor value! is not defined/);
    const writeonly = box.replace("        value?\n", "").replace("Box:value?\n    return @value\n", "");
    assert.throws(() => compile(writeonly + "\nmain(args)\n    k = new Box()\n    return k.value?\n"), /accessor value\? is not defined/);
});

test("accessor declarations validate implementation, arity, and native member collisions", () => {
    const cases = [
        "class K\n    properties\n        field?\n",
        "class K\n\nK:field?(value)\n    return value\n",
        "class K\n\nK:field!(first, second)\n    return null\n",
        "class K\n\nK:field!(value = null)\n    return null\n",
        "class K\n    properties\n        field\n        field?\n\nK:field?\n    return 1\n",
        "class K\n    methods\n        field?()\n\nK:field?\n    return 1\n",
        "class K\n\nK::field?\n    return 1\n",
    ];
    for (const source of cases)
        assert.equal(diagnose(source)[0]?.code, "LNG1274", source);
});

test("private accessors retain backing fields and automatic callback receivers", async () => {
    const source = `export main(args)

class Counter
    methods
        callback()

Counter()
    @value = 1

Counter:value?
    return @value

Counter:value!(value)
    @value = value

Counter:callback()
    action = ()
        @value! = @value? + 1
        return @this.value?
    return action

main(args)
    counter = new Counter()
    action = counter.callback()
    return action()
`;
    await built(source, "node", async (program) => assert.equal(program.main([]), 2));
    assert.throws(() => compile(source.replace("    return action()", "    return counter.value?")), /accessor value\? is private/);
});

test("imported accessor metadata supports independent inherited getter/setter overrides", async () => {
    const source = `import "./base"
    class Base
        properties
            value?
            value!

export main(args)

class Child : Base
    properties
        value?

Child:value?
    return super.value? + 1

main(args)
    child = new Child()
    child.value! = 5
    return child.value?
`;
    await built(source, "node", async (program) => assert.equal(program.main([]), 6), {
        "base.lango": box.replace("export main(args)\n\n", "").replaceAll("Box", "Base"),
    });
});

test("kebab and Decimal accessor names retain their native property names", async () => {
    const source = `export main(args)

export class Price
    properties
        display-name?
        display-name!
        $amount?
        $amount!

Price()
    @name = ""
    @$amount = $0

Price:display-name?
    return @name

Price:display-name!(value)
    @name = value

Price:$amount?
    return @$amount

Price:$amount!($value)
    @$amount = $value

main(args)
    price = new Price()
    price.display-name! = "Total"
    price.$amount! = $10
    $sum = price.$amount? + $2
    return "\${price.display-name?}: \${$sum}"
`;
    await built(source, "node", async (program) => {
        assert.equal(program.main([]), "Total: 12");
        assert.equal(typeof Object.getOwnPropertyDescriptor(program.Price.prototype, "display-name").get, "function");
    });
});

test("accessor interpolation preserves XML and quoted keys while aliases keep visibility checks", async () => {
    const source = box + `
main(args)
    k = new Box()
    alias = k
    alias.value! = 8
    tag = <value state="\${k.value?}">literal? literal! \${k.value?}</value>
    data = {
        "value?": "literal!"
    }
    return {
        xml: tag
        text: data["value?"]
    }
`;
    await built(source, "node", async (program) => {
        assert.deepEqual(program.main([]), { xml: '<value state="8">literal? literal! 8</value>', text: "literal!" });
    });
    assert.equal(diagnose(source.replace("alias.value! = 8", "alias.value = 8"))[0]?.code, "LNG1274");
});

test("overriding only a setter retains the ancestor getter, including lexical super in callbacks", async () => {
    const source = box + `
class Child : Box
    properties
        value!
    methods
        callback()

Child:value!(value)
    super.value! = value + 1

Child:callback()
    return ()
        return super.value?

main(args)
    child = new Child()
    child.value! = 9
    read = child.callback()
    return read() + child.value?
`;
    await built(source, "node", async (program) => assert.equal(program.main([]), 20));
});

test("setter Decimal boundaries cover explicit and own receivers", () => {
    for (const receiver of ["@value!", "@this.value!"]) {
        const source = box.replace("    @value = 0", `    ${receiver} = $1`) + "\nmain(args)\n    return null\n";
        assert.equal(diagnose(source)[0]?.code, "LNG1274", receiver);
    }
    const source = box + "\nmain(args)\n    k = new Box()\n    k.value! = $1\n";
    assert.equal(diagnose(source)[0]?.code, "LNG1274");
});
