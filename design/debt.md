# Lango Design Debt

This is the list of intentionally unresolved language and implementation work.
Items belong here until an explicit decision moves them to `decisions.md`.

## Language semantics

### Decimal runtime and lowering

Implement dollar-marked bindings, properties, parameters, object/JSON fields,
Decimal operation lowering, the pinned embedded backend, configured division,
and explicit JavaScript/SQL boundary conversion.

### Definite assignment and non-coercive operations

Complete path-sensitive local definite-assignment analysis across branches,
loops, and try/catch/finally. Enforce the accepted non-coercive operation model
without regressing explicit interpolation or JavaScript interop boundaries.

## JavaScript interoperability

### Remaining host-boundary coverage

Decimal arguments are rejected at JavaScript namespace-call, `fetch`, constructor,
direct `args` host-method, and inferred host-callable boundaries unless explicitly
converted with `to_js_number`. Future host interop additions must extend this
analysis and its conformance tests before exposing new dynamic callable paths.

### Advanced database connections and transactions

Design a separate library for explicit connection selection, multiple databases,
pooling, SQL savepoints, and independent transactions. The core library has one
contextual default connection and join-only nested transactions (D-054).

## Tooling

### Expand executable conformance examples

Faz 1 establishes the first formatting and compiler/runtime fixtures; Faz 103
adds a Promise-chain fixture. Continue adding a Lango input, expected
JavaScript output, and runtime assertion for every accepted decision as its
implementation becomes available.
