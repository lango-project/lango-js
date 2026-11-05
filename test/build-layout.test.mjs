import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile } from "../src/compiler.mjs";

async function fixture(files) {
    const root = await mkdtemp(path.join(os.tmpdir(), "lango-layout-"));
    for (const [name, content] of Object.entries(files)) {
        const file = path.join(root, name);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, content);
    }
    return root;
}

async function snapshot(directory) {
    const names = await readdir(directory, { recursive: true, withFileTypes: true });
    return Object.fromEntries(await Promise.all(names.filter(item => item.isFile()).map(async item => {
        const file = path.join(item.parentPath, item.name);
        return [path.relative(directory, file), await readFile(file, "utf8")];
    })));
}

for (const target of ["node", "browser"])
test(`${target} build keeps parent/sibling imports inside output and shares diamond dependencies`, async () => {
    const root = await fixture({
        "source/tools/main.lango": `import "../src/left/item"
    left()
import "../src/right/item"
    right()
export result()

result()
    return [left(), right()]
`,
        "source/src/left/item.lango": `import "../shared"
    global identity
export left()

left()
    return identity
`,
        "source/src/right/item.lango": `import "../shared"
    global identity
export right()

right()
    return identity
`,
        "source/src/shared.lango": "export global identity\n\nglobal identity = {}\n",
    });
    const before = await snapshot(path.join(root, "source"));
    const output = path.join(root, "dist/renamed.mjs");
    await buildFile(path.join(root, "source/tools/main.lango"), output, new Set(), false, { target });
    const module = await import(pathToFileURL(output).href);
    const [left, right] = module.result();
    assert.equal(left, right);
    assert.deepEqual(await snapshot(path.join(root, "source")), before);
    assert.ok((await readFile(output, "utf8")).includes('"./src/left/item.mjs"'));
    assert.ok((await readFile(path.join(root, "dist/src/left/item.mjs"), "utf8")).includes('"../shared.mjs"'));
    const emitted = await snapshot(path.join(root, "dist"));
    assert.equal(Object.keys(emitted).filter(name => name.endsWith("shared.mjs")).length, 1);
});

test("renamed entry cannot collide with an imported module", async () => {
    const root = await fixture({
        "main.lango": 'import "./helper"\n    value()\nexport result()\n\nresult()\n    return value()\n',
        "helper.lango": "export value()\n\nvalue()\n    return 42\n",
    });
    const output = path.join(root, "dist/helper.mjs");
    await buildFile(path.join(root, "main.lango"), output);
    const module = await import(pathToFileURL(output).href);
    assert.equal(module.result(), 42);
});

test("cross-folder function cycles import the renamed entry instead of emitting a duplicate", async () => {
    const root = await fixture({
        "source/app/main.lango": `import "../lib/other"
    other()
export result()
export value()

result()
    return other()

value()
    return 42
`,
        "source/lib/other.lango": 'import "../app/main"\n    value()\nexport other()\n\nother()\n    return value()\n',
    });
    const output = path.join(root, "dist/renamed.mjs");
    await buildFile(path.join(root, "source/app/main.lango"), output);
    const module = await import(pathToFileURL(output).href);
    assert.equal(module.result(), 42);
    const other = await readFile(path.join(root, "dist/lib/other.mjs"), "utf8");
    assert.ok(other.includes('"../renamed.mjs"'));
});
