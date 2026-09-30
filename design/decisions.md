# Lango Design Decisions

This document is the normative companion to `guide.md`. The guide teaches the
language; this document records choices that a parser, transpiler, formatter,
or standard library must follow.

Each decision has a status. **Accepted** decisions are part of the current
language contract. **Draft** decisions are implementation directions that may
still move to `debt.md` before the first stable compiler release.

## D-001: JavaScript is the runtime target

**Status:** Accepted

Lango is transpiled to JavaScript and executes in the JavaScript runtime. It
does not introduce a separate VM or object model. Existing JavaScript values,
functions, objects, and libraries are callable from Lango unless a Lango
standard-library name explicitly adapts them.

The first compiler target is modern ECMAScript. The exact supported ECMAScript
version and module output format are tracked in `debt.md`.

## D-002: Blocks are line-oriented and indentation-delimited

**Status:** Accepted

A block begins after a block-introducing construct and continues while source
lines are more indented than its parent line. Blank lines do not affect block
structure. Comments are ignored for block structure.

Source files use UTF-8 and spaces for indentation. A formatter emits two spaces
per nesting level. The lexer rejects a tab in leading whitespace, so that one
file has one unambiguous visual structure.

An unclosed parenthesis, bracket, or brace continues the current logical line.
Inside an object literal, a newline separates entries just as a comma would.

Within an explicitly grouped expression, a closing `)`, `]`, or `}` may dedent
to the indentation of the expression that opened the group. That dedent closes
any indentation blocks inside the group but does not end the grouped expression;
a following `.method(...)` therefore remains part of the same chain.

The precise indentation rule for `else` is deliberately not accepted yet; see
`debt.md`.

## D-003: Bindings are lexical and must be definitely assigned

**Status:** Draft

The first assignment to a bare identifier creates a binding in the current
lexical scope. Reading a local binding before it is definitely assigned is a
compile-time error.

A branch establishes a binding after the branch only when every reachable
branch assigns it. Function parameters are assigned when the function begins.
The exact rules for loops, exceptions, closures, and asynchronous code remain
open work.

File-level bindings are module globals. A function or method accesses one with
an explicit `global name` declaration. This makes shared mutable state visible
at the point of use.

## D-004: Function and class declaration forms are distinct

**Status:** Draft

At declaration position, `name(parameters)` starts a function declaration.
Within an expression, `(parameters)` followed by an indented block is an
anonymous function value. A named function value can be assigned with
`name = (parameters)`.

`class Name` declares a class. Within its implementation:

* `Name(parameters)` is the constructor.
* `Name:method(parameters)` is an instance method.
* `fn Name::method(parameters)` is a static method.

The transpiler emits JavaScript `class` syntax; constructing `Name()` in
Lango emits `new Name()` when `Name` resolves to a Lango class. Calls to an
unknown or imported JavaScript function remain ordinary JavaScript calls.

## D-005: Properties use explicit sigils

**Status:** Draft

`@name` denotes an instance property and `@@name` denotes a static property.
They are never local variables. A class `properties` section declares the
public instance-property surface; the names listed there are accessed internally
as `@name` and externally through normal JavaScript property access.

An `@` property that is not listed in `properties` is private to the Lango class
contract. JavaScript cannot enforce this for interoperable objects, so privacy
is checked by the Lango compiler rather than by a JavaScript private field.

## D-006: Relaxed JSON object literals compile to plain objects

**Status:** Accepted

`{}` creates a JavaScript object. Object entries may be separated by commas or
by logical-line boundaries. Unquoted identifier keys and quoted string keys are
both valid. Dot and bracket access have their JavaScript meanings:

```lango
person = {
  name: "Savaş"
  age: 42,
}
person.name
person["name"]
```

Lango does not add a special record type at this stage; object identity and
mutation follow JavaScript semantics.

## D-007: Arrays keep JavaScript representation with Lango-friendly aliases

**Status:** Accepted

Array literals compile to JavaScript arrays. `array.add(value)` is a Lango
standard-library alias for JavaScript `array.push(value)` and returns the same
value as `push` (the resulting length). Other JavaScript array methods remain
available as-is.

## D-008: Loop forms lower to structured JavaScript control flow

**Status:** Draft

`loop while condition`, `loop until condition`, and unqualified `loop` lower
to JavaScript `while` loops. `until condition` negates its condition.

`for collection as item` iterates values. `for object as key: value` iterates
own enumerable key/value pairs using `Object.entries(object)`. A leveled
`break N` or `continue N` is emitted with compiler-generated JavaScript labels;
`N` must be a positive integer literal and may not exceed the enclosing loop
depth.

## D-009: Switch cases do not fall through implicitly

**Status:** Draft

In `switch expression`, a sequence of consecutive `case` labels with no body
shares the next body. Once a case body completes, control leaves the switch.
`else` is the default case. In condition-only `switch`, each `case` expression
is evaluated in order and the first truthy result selects its body.

This removes accidental JavaScript fallthrough while preserving the grouped
case form shown in the guide.

## D-010: One equality operator, no coercive equality

**Status:** Accepted

Lango has one equality spelling: `==`. It never performs JavaScript's coercive
`==` comparison. For ordinary values it transpiles to JavaScript strict equality
(`===`). JavaScript `===` is not valid Lango source.

Text equality follows the text comparison policy described in D-011.

## D-011: Quote style carries text intent

**Status:** Draft

Single-quoted literals are programmatic strings. Double-quoted literals are
texts: they are eligible for translation extraction and support interpolation.
Both compile to JavaScript strings.

Interpolation has one spelling, `${expression}`, in a double-quoted text.
Texts compare case-insensitively as stated in the guide. The Unicode
normalization and locale policy needed to make that deterministic is unresolved
and is tracked in `debt.md`.

Triple double quotes create a multiline text. Its closing delimiter determines
the end of the literal; formatter indentation stripping rules are open work.

## D-012: Closures make nonlocal local bindings explicit

**Status:** Draft

A closure may read its own parameters and bindings created inside its body.
Reading a local binding from an enclosing lexical function requires a
`capture name` declaration in the closure body. The declaration is a
compile-time dependency declaration; JavaScript's normal closure mechanism
provides the runtime capture.

`global` bindings, `context` bindings, and imports follow their own explicit
access rules and do not need a `capture` declaration. An instance or static
property used by a closure must be listed as `capture @property` or
`capture @@property`. A missing required capture is a compile-time error.

Capturing `@property` retains the class instance on which the closure was
created; it does not copy the property's current value. Capturing `@@property`
retains its declaring class. The compiler verifies that every captured property
and every property used in the closure resolves to a valid class member, which
makes an accidental property name a compile-time error. The generated closure
therefore safely outlives the method that created it while continuing to access
the original owner. Access to an instance/static property is invalid outside a
class-member context.

## D-013: Context is dynamically scoped, immutable binding state

**Status:** Draft

`context name = value` establishes or shadows a named context binding for the
remainder of the current dynamic call scope. When that scope returns or throws,
the prior binding is restored. `context name` declares that a function reads
the binding; after that declaration, `name` reads the current context value.

Context values cannot be assigned through a bare `name = value` assignment.
Another `context name = value` creates a nested binding instead. A read of an
unavailable context binding is a runtime error with the requested context name.

The cross-async-boundary propagation mechanism and host-runtime support remain
open work in `debt.md`.

## D-014: JSON helpers use explicit conversion boundaries

**Status:** Draft

`from_json(text)` parses a JSON text and returns ordinary Lango values: plain
objects, arrays, strings, booleans, null, and numbers according to the Lango
number model. Invalid JSON raises a parse error; it never returns a sentinel
value.

`to_json(value)` serializes supported ordinary Lango values to a programmatic
string. Serialization failures, including unsupported values and cyclic object
graphs, are errors. The representation of texts and arbitrary-precision
numbers is not decided yet.

## D-015: Embedded SQL uses bound parameters, never textual interpolation

**Status:** Draft

An `SQL` literal is a structured query template. An `@name` occurrence in the
template denotes a named parameter, not a textual substitution. Assigning
`result.name = value` provides the parameter value before `result.execute()`.
The environment adapts the template and bindings to its database driver.

Interpolating a Lango text expression into SQL source is not permitted. Values
must be represented by `@name` parameters, so query text and data remain
separate. The result-set API, statement classification, adapter interface, and
multiple-database syntax remain open work.

## D-016: Embedded XML is a balanced literal form

**Status:** Draft

An XML literal begins with an XML start tag in expression position and ends at
its matching closing tag, or is a self-closing tag. The parser validates tag
balance and reports malformed XML as a source error; arbitrary unclosed chunks
are not accepted.

An XML literal evaluates to text. Interpolation may occur only in text and
attribute-value positions using the normal `${expression}` syntax. The exact
XML escaping policy and the lexical disambiguation from comparison operators
remain open work.

## D-017: File exports and class-member visibility are separate

**Status:** Draft

`export` controls module visibility: an exported declaration can be imported
by another source file. Declarations that are not exported remain usable by all
code in the same source file.

A class's `properties` and `methods` sections declare its member API; they do
not themselves export the class from its file. An external caller can use that
API only after the class has been exported and imported. This keeps module
visibility separate from private/protected member visibility.

## D-018: Property sigils encode class-member visibility

**Status:** Draft

`@name` is a private instance property, `@@name` is a static property, and
`_name` is a protected instance property. `_name` is a class member rather than
a lexical local binding, even though it does not carry the `@` sigil. It may be
used by the declaring class and its descendants, but not by unrelated code.

Names in the `properties` section form the externally accessible instance
property API. A protected name may be shown there for documentation, but it does
not become public through that listing. The syntax and policy for protected
static properties remain open work.

## D-019: Inheritance uses an ancestor class and `super`

**Status:** Draft

`class Child : Parent` declares single inheritance. Re-declaring an inherited
method in `Child` overrides it. `super` accesses the ancestor implementation,
including its constructor where applicable; it never refers to a derived class.

Constructor ordering, inherited public API declarations, static member
inheritance, and the exact `super` call syntax remain open work.

## D-020: Macro names and expansion form a separate compile-time phase

**Status:** Draft

All-uppercase identifiers are reserved for macros and macro bindings; ordinary
variables, parameters, functions, classes, and imports may not use an entirely
uppercase identifier. Imported JavaScript values with such a name must be given
a non-all-uppercase alias.

The compiler parses all source files, resolves import/export headers and the
module graph, registers imported macros, and then expands macro calls. Text
translation extraction runs after macro expansion, so it sees text literals in
the generated program rather than macro template literals.

`PASTE(value)` inserts source into the expansion result. A pasted source fragment
may contain another macro call; expansion stops with an error after 16 rounds.
Macros may not generate `import` or `export` declarations, keeping the already
resolved module graph stable. Macro diagnostics retain both the macro call site
and generated-source location where possible.

## D-021: Relaxed JSON is an ordinary positional object argument

**Status:** Draft

Lango has no named-parameter call syntax and no destructuring. A relaxed JSON
object supplied in a call is one ordinary positional argument. For example,
`register_student({ name: "Savaş" })` passes one object; it does not bind a
function parameter named `name`. A receiving function reads its fields through
normal property access.

## D-022: Test blocks are compile-time discoverable tests

**Status:** Draft

`test` introduces a test block anywhere ordinary source is allowed. A quoted
text after `test` is its display name; unnamed tests receive a stable name based
on their source location. Test blocks are discovered and run by the test runner
and are excluded from a production build.

`assert expression` evaluates the expression and fails when it is false. The
compiler retains the expression's source span so the test runner can report the
original failed expression. Async-test behavior remains open work.

## D-023: Reflection exposes JavaScript constructors explicitly

**Status:** Draft

`get_class(value)` returns the JavaScript-style constructor associated with a
value, analogous to `value.constructor`. It therefore returns constructors such
as `Object`, `Array`, or a Lango class constructor rather than a textual class
name. `is_kindof(value, Class)` uses inheritance-aware instance semantics
analogous to JavaScript `instanceof`.

The behavior for null, undefined, primitive values, altered `constructor`
properties, and cross-realm JavaScript values remains open work.

## D-024: Dynamic values use explicit, non-coercive operations

**Status:** Accepted

Lango is dynamically typed. It has Boolean literals `true` and `false`, and no
type annotations, generic syntax, or static type system in the current language.
Runtime predicates such as `is_number` and `is_kindof` are the explicit way to
inspect a value's kind.

Conditions in `if`, `loop while`, `loop until`, and condition-only `switch`
must evaluate to a Boolean. Lango does not apply JavaScript truthiness: numbers,
programmatic strings, texts, objects, arrays, null, and undefined are not
implicitly accepted as conditions.

There are no implicit value conversions. Arithmetic operators, including `+`,
operate on numbers only. Text is composed with interpolation rather than string
concatenation. `and`, `or`, and `not` require Boolean operands; `and` and `or`
short-circuit and produce a Boolean result. D-010 continues to define `==` as
non-coercive equality.

When a dynamically obtained or imported JavaScript value is used where a
Boolean or number is required, the transpiled program raises a Lango runtime
type error instead of applying JavaScript coercion.

## D-025: Default parameters are positional JavaScript-compatible arguments

**Status:** Accepted

A function or method parameter may declare a default value with `name =
expression`. When the caller omits that argument or supplies `undefined`, the
default expression is evaluated using JavaScript-compatible default-parameter
semantics. Arguments remain positional; this feature does not introduce named
arguments.

Defaulted parameters may appear in any parameter position, matching JavaScript;
a later required parameter must still receive an argument in its own position.
Omitting a required parameter is an error: the compiler reports it for a
statically known Lango call, and the generated function raises a Lango runtime
arity error when invoked dynamically from JavaScript or a callback.

Lango has no rest-parameter or argument-spread syntax. A variable number of
values is represented by one array positional argument; an array is never
expanded automatically into multiple arguments. A Lango function ignores excess
arguments, matching JavaScript function calls and allowing JavaScript APIs to
invoke Lango callbacks with additional callback arguments. Calling a JavaScript
variadic API with an array remains possible through its ordinary JavaScript
`apply` method.

Function overloads are excluded by D-026.

## D-026: Functions do not overload by signature

**Status:** Accepted

Two functions or methods with the same name in the same declaration scope are a
compile-time error, regardless of their parameter lists. Lango does not select
an implementation by argument count or value type. A different calling shape
uses a distinct name, D-025 default parameters, or one positional object
argument.

## D-027: Instance methods are not detachable callbacks

**Status:** Accepted

An instance method call has an explicit receiver: `manager.add(1, 2)` invokes
`add` with `manager` as its instance. Taking an instance method as a bare value,
such as `callback = manager.add`, is a compile-time error. Lango never silently
creates a bound callback or exposes JavaScript's unbound-`this` behavior.

To pass instance behavior as a callback, source code creates an explicit
closure, captures any outer local bindings and properties it uses, and calls the
method through its receiver. This makes callback dependencies and receiver
lifetime visible in source. The behavior of methods on imported JavaScript
objects remains part of the JavaScript-interoperability contract.

## D-028: Callbacks use ordinary Lango closure semantics

**Status:** Accepted

A Lango closure passed to another function is invoked as an ordinary Lango
function. Its declared positional parameters receive the callback arguments;
excess arguments are ignored and missing required arguments raise the D-025
runtime arity error.

A JavaScript API's callback receiver (`this`) is not exposed to Lango code and
cannot replace a receiver preserved by D-012. A callback receives outside state
only through its parameters, `capture` declarations, `global` declarations, or
`context` declarations. The transpiler lowers Lango closures with lexical
receiver semantics so JavaScript callback invocation cannot introduce an implicit
receiver.

## D-029: Promise control flow is explicit and JavaScript-native

**Status:** Accepted

Lango has no `async` or `await` keyword. A function that returns a JavaScript
Promise returns that Promise to its caller; the caller handles it through
ordinary method calls and closures. The compiler does not infer or propagate an
asynchronous effect through Lango functions.

Promise chaining uses the standard JavaScript `then`, `catch`, and `finally`
methods with existing Lango closure syntax. A `return` from a `then` closure
supplies the next chain value; returning a Promise follows JavaScript Promise
flattening semantics. A `throw` inside a chain closure produces a rejection
that a later `catch` can receive. HTTP status failures remain normal responses
unless application code checks a response such as `output.ok` and throws.

Lango does not introduce special Promise-chain block syntax or a separate
Promise type.

## D-030: Bindings and properties are mutable by default

**Status:** Accepted

Local bindings, file globals, context bindings within their dynamic scope, and
object or class properties may be reassigned after their first assignment.
Lango has no `const`, `readonly`, or immutable-binding declaration. Immutability
is expressed by program convention or by using an immutable value supplied by a
library, not by core language syntax.

As a JavaScript output optimization, the transpiler may emit `const` for a
local or file-level binding when it can prove that the binding is initialized
once and never reassigned in its emitted lexical scope. Object/property mutation
does not prevent this optimization because the binding's reference is unchanged.
Otherwise it emits a mutable JavaScript binding. This choice has no observable
Lango-language effect and does not make the source binding immutable.
