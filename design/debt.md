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

### XML literals

Implement validated XML literals, escaped interpolation, and their runtime
representation.

## JavaScript interoperability

### Complete module interfaces

Validate selected imported globals against their exported module interfaces.
Imported class properties, methods, static values, and static
methods are already checked, including inherited public members. Class
inheritance cycles are rejected. Add cyclic-module initializer-read analysis.

### Remaining host-boundary coverage

Extend JavaScript interop diagnostics and value-boundary coverage where an
ordinary JavaScript value can still cross without a Lango-specific error.

### Advanced database connections and transactions

Design a separate library for explicit connection selection, multiple databases,
pooling, SQL savepoints, and independent transactions. The core library has one
contextual default connection and join-only nested transactions (D-054).

## Tooling

### Formatter and format command

Implement the deterministic formatter: four-space indentation, import/export
ordering, blank-line normalization, trailing-whitespace removal, TAB rejection,
and a CLI entrypoint.

### Expand executable conformance examples

Faz 1 establishes the first formatting and compiler/runtime fixtures. Every
accepted decision should gain at least one Lango input, expected JavaScript
output, and a runtime assertion as its implementation becomes available.
