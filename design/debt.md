# Lango Design Debt

This is the list of intentionally unresolved language and implementation work.
Items belong here until an explicit decision moves them to `decisions.md`.

## Language semantics

### Configurable Decimal runtime and lowering

Dollar-marked bindings, properties, parameters, object/JSON fields, operation
lowering, the pinned embedded backend, configurable division, and the baseline
JavaScript/SQL boundary conversion exist. Extend boundary analysis and
conformance tests whenever a new host callable path is introduced.

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

### Diagnostic model and recovery

`LangoError` now carries severity and parser source spans, and independent
top-level declaration-name failures are grouped in its `diagnostics` array.
Extend this to semantic analysis and parser recovery: diagnostics need stable
code, source file, one-based start/end line and column, optional related
locations, and safe recovery that returns further independent errors while still
preventing emission.

### Host integration and distributable CLI

Define and document the public host bootstrap API for output, catalog, and the
default database adapter. Make the command-line tool usable as a package
(package entry/bin metadata, supported Node-version checks, and CI smoke
coverage) without hard-coding a deployment-specific database choice.

### Documentation and decision consistency

Keep `README.md`, `guide.md`, and `decisions.md` synchronized with implemented
phases. In particular, record phases 185 onward, resolve implemented decisions
left in Draft state, remove stale claims that optional chaining is unsupported,
and give distinct decision identifiers to distinct decisions.

### Expand executable conformance examples

Faz 1 establishes the first formatting and compiler/runtime fixtures; Faz 103
adds a Promise-chain fixture. Continue adding a Lango input, expected
JavaScript output, and runtime assertion for every accepted decision as its
implementation becomes available.
