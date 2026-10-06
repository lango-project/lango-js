import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildFile, LangoError } from "../src/compiler.mjs";

const librarySource = `export class Account
    properties
        balance
    methods
        deposit(amount)
    static
        create(balance)
        currency = "USD"

Account(balance)
    @balance = balance

Account:deposit(amount)
    @balance = @balance + amount

Account::create(balance)
    return new Account(balance)
`;

test("Faz 82 validates selected imported class APIs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase82-"));
    const library = path.join(directory, "account.lango");
    const input = path.join(directory, "main.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(library, librarySource);
    await writeFile(input, `import "./account"
    class Account
        properties
            balance
        methods
            deposit(amount)
        static
            create(balance)
            currency

export main(args)

main(args)
    return Account.create(1)
`);
    await buildFile(input, output);
});

test("Faz 82 rejects a class member absent from its imported API", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase82-"));
    const library = path.join(directory, "account.lango");
    const input = path.join(directory, "main.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(library, librarySource);
    await writeFile(input, `import "./account"
    class Account
        methods
            withdraw(amount)
`);
    await assert.rejects(
        () => buildFile(input, output),
        (error) => error instanceof LangoError && error.code === "LNG1234",
    );
});

test("Faz 82 accepts inherited public members in a class import API", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase82-"));
    const library = path.join(directory, "account.lango");
    const input = path.join(directory, "main.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(library, `class Base
    properties
        id
    methods
        label()

export class Account : Base

Base(id)
    @id = id

Base:label()
    return @id

Account(id)
    super(id)
`);
    await writeFile(input, `import "./account"
    class Account
        properties
            id
        methods
            label()
`);
    await buildFile(input, output);
});
