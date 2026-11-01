import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { buildFile } from "../src/compiler.mjs";

const execFileAsync = promisify(execFile);

test("browser targets propagate to dependencies and run without Node globals", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-browser-"));
    const input = path.join(directory, "main.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(path.join(directory, "child.lango"), `export double(value)

double(value)
    return value * 2
`);
    await writeFile(input, `import "./child"
    double(value)

export run(value)

run(value)
    context log
    log.info("browser")
    return double(value)
`);
    await buildFile(input, output, new Set(), false, { target: "browser" });
    const runtime = await readFile(path.join(directory, ".lango/runtime.mjs"), "utf8");
    assert.doesNotMatch(runtime, /node:|process\./);
    const { stdout, stderr } = await execFileAsync(process.execPath, [
        "--experimental-vm-modules", "--input-type=module", "-e", `
import { readFile } from "node:fs/promises";
import { SourceTextModule, createContext } from "node:vm";
import { pathToFileURL } from "node:url";
const context = createContext({ console: { info() {} } });
const modules = new Map();
async function load(url) {
    if (modules.has(url)) return modules.get(url);
    const pending = readFile(new URL(url), "utf8").then(source => new SourceTextModule(source, { context, identifier: url }));
    modules.set(url, pending);
    return pending;
}
const entry = await load(pathToFileURL(process.argv[1]).href);
await entry.link((specifier, parent) => {
    if (!specifier.startsWith(".")) throw new Error("Unexpected host import: " + specifier);
    return load(new URL(specifier, parent.identifier).href);
});
await entry.evaluate();
process.stdout.write(String(entry.namespace.run(4)));
`, output,
    ]);
    assert.equal(stdout.trim(), "8", stderr);
});

test("browser builds reject Node modules and executable mode", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-browser-invalid-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, 'import js "node:fs" as fs\n\nexport run()\n\nrun()\n    return fs\n');
    await assert.rejects(buildFile(input, output, new Set(), false, { target: "browser" }), /cannot import node:/);
    await assert.rejects(buildFile(input, output, new Set(), false, { target: "browser", executable: true }), /cannot use --executable/);
});
