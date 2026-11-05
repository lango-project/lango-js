import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile } from "../src/compiler.mjs";

const base = `export class Base
    properties
        label
    methods
        describe(suffix = "base")

Base(label)
    @label = label

Base:describe(suffix = "base")
    return "\${@label}: \${suffix}"

Base:hidden()
    return null
`;

async function fixture(t, main, middle = null) {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-imported-inheritance-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    await writeFile(path.join(directory, "base.lango"), base);
    if (middle) await writeFile(path.join(directory, "middle.lango"), middle);
    await writeFile(path.join(directory, "main.lango"), main);
    const output = path.join(directory, "out", "main.mjs");
    await buildFile(path.join(directory, "main.lango"), output);
    return { output, program: await import(pathToFileURL(output).href) };
}

test("imported ancestors retain aliased multi-module APIs, constructor defaults and inherited public fields", async t => {
    const middle = `import "./base"
    alias Parent = class Base

export class Middle : Parent
    methods
        describe(suffix = "middle")

Middle:describe(suffix = "middle")
    return super.describe(suffix)
`;
    const { output, program } = await fixture(t, `import "./middle"
    class Middle
        properties
            label

export class Child : Middle
    methods
        run()
        callback()

Child(label)
    super(label)
    @label = "\${@label}!"

Child:run()
    return describe()

Child:callback()
    return ()
        return @label
`, middle);
    const child = new program.Child("Ada");
    assert.equal(child.run(), "Ada!: middle");
    assert.equal(child.callback()(), "Ada!");
    assert.equal(child.label, "Ada!");
    const emitted = await readFile(output, "utf8");
    assert.doesNotMatch(emitted, /#label|^    label;/m);
});

test("implicit constructors forward arguments to imported ancestors", async t => {
    const { program } = await fixture(t, `import "./base"
    class Base

export class Child : Base
`);
    assert.equal(new program.Child("Ada").describe(), "Ada: base");
});

for (const [name, declaration, code] of [
    ["private override", `    methods\n        hidden()\n\nChild:hidden()\n    return null\n`, "LNG1237"],
    ["private super call", `    methods\n        run()\n\nChild:run()\n    return super.hidden()\n`, "LNG1240"],
    ["required super argument", `\nChild()\n    super()\n`, "LNG1203"],
]) {
    test(`imported inheritance rejects ${name}`, async t => {
        await assert.rejects(fixture(t, `import "./base"\n    class Base\n\nexport class Child : Base\n${declaration}`), error => error.code === code);
    });
}
