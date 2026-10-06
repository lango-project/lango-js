import assert from "node:assert/strict";
import { compile, buildFile, LangoError } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const source = `export main(args)

export class Account
    methods
        total()
        ::zero()

Account(value)
    @value = value

Account:total()
    this.validate()
    return @value

Account:validate()
    return null

Account::zero()
    return Account.create_zero()

Account::create_zero()
    return new Account(0)

main(args)
    account = Account.zero()
    println(account.total())
`;

test("Faz 18 emits methods absent from the API list as JavaScript private methods", () => {
    const output = compile(source).javascript;
    assert.match(output, /total\(\)/);
    assert.match(output, /static zero\(\)/);
    assert.match(output, /#validate\(\)/);
    assert.match(output, /this\.\#validate\(\)/);
    assert.match(output, /static #create_zero\(\)/);
    assert.match(output, /Account\.\#create_zero\(\)/);
});

test("Faz 18 requires every listed public method to have an implementation", () => {
    const invalid = source.replace("Account:total()", "Account:other()");
    assert.throws(() => compile(invalid), (error) => error instanceof LangoError && error.code === "LNG1209");
});

test("Faz 18 public-methods fixture runs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase18-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/018-public-methods/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["0"]);
});
