import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "../src/compiler.mjs";

test("Phase 242 supports assigning a namespaced constructor callback result", () => {
    const output = compile(`import js "node:http" as http

main(args)
    server = new http/Server((request, response)
        response.end("ok")
    )
`).javascript;
    assert.match(output, /let server = new http\.Server\(__withArity\(\(request, response\) =>/);
});
