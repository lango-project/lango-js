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

### Establish executable examples

Every accepted decision should gain at least one Lango input, expected JavaScript
output, and a runtime assertion. Start with parsing/formatting fixtures before
the full transpiler exists.

### Test execution model

Specify test discovery order, test isolation, setup/teardown, assertion error
format, filtering, coverage, async tests, and how tests interact with imports,
macros, context, and production build output.
