# Lango Design Debt

This is the list of intentionally unresolved language and implementation work.
Items belong here until an explicit decision moves them to `decisions.md`.

## Language semantics

## JavaScript interoperability

### Advanced database connections and transactions

Design a separate library for explicit connection selection, multiple databases,
pooling, SQL savepoints, and independent transactions. The core library has one
contextual default connection and join-only nested transactions (D-054).

## Tooling

### Expand executable conformance examples

Faz 1 establishes the first formatting and compiler/runtime fixtures. Every
accepted decision should gain at least one Lango input, expected JavaScript
output, and a runtime assertion as its implementation becomes available.
