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

The first compiler target is ECMAScript 2022 modules. It emits `.mjs` files and
uses only ESM; CommonJS output is not produced. The Node host baseline is Node
24 or later. Browser output targets modern browsers with native ESM support;
bundling is the host or build tool's responsibility rather than Lango source.

The compiler emits an external source map for every generated `.mjs` file,
including source content, and adds its `sourceMappingURL` reference. Compiler
runtime helpers, including the embedded Decimal runtime, are private sibling ESM
modules or are included by the host bundler. Generated code does not require a
user-installed runtime helper package. A future compatibility target for older
runtimes is a separate output mode and cannot change this baseline's semantics.

## D-002: Blocks are line-oriented and indentation-delimited

**Status:** Accepted

A block begins after a block-introducing construct and continues while source
lines are more indented than its parent line. Blank lines do not affect block
structure. Comments are ignored for block structure.

Source files use UTF-8 and spaces for indentation. A formatter emits four spaces
per nesting level. The TAB character (U+0009) is forbidden anywhere in source,
including text literals and comments; write a tab in text with the `\t` escape.
This keeps one file's visual structure unambiguous.

An unclosed parenthesis, bracket, or brace continues the current logical line.
Inside an object literal, a newline separates entries just as a comma would.

Within an explicitly grouped expression, a closing `)`, `]`, or `}` may dedent
to the indentation of the expression that opened the group. That dedent closes
any indentation blocks inside the group but does not end the grouped expression;
a following `.method(...)` therefore remains part of the same chain.

An `if` header begins at a normal indentation column (a multiple of four); its
then-body begins four columns farther in. Its associated `else` begins exactly
two columns farther in than that `if`, and the else-body begins four columns
farther in than the `else` (six columns farther in than the `if`). This unusual
half-step is deliberate: it makes `else` visually subordinate to its `if`
without making it look like part of the then-body. Only an `else` and its direct
body use those non-four-column positions. A misplaced `else`, or an `else` at
the same column as its `if`, is a syntax error.

An `else` binds to the most recent unmatched `if` exactly two columns to its
left; it never binds across another completed conditional. Thus a nested `if`
uses the same four/two/four pattern relative to its own header. A dangling
`else`, a second `else` for one `if`, or an `else` at any other column is a
syntax error.

`switch` labels use the same visual half-step: each `case` and the switch's
`else` begin two columns farther in than their `switch`, and each label body
begins four columns farther in than the label. A `case` or switch `else` at any
other column is a syntax error.

## D-003: Bindings are lexical and must be definitely assigned

**Status:** Accepted

The first assignment to a bare identifier creates a binding in the current
lexical scope. Reading a local binding before it is definitely assigned is a
compile-time error.

A branch establishes a binding after the branch only when every normally
continuing branch assigns it. Function parameters are assigned when the
function begins. A path ending in `return`, `throw`, `break`, or `continue`
does not normally continue for this analysis.

An assignment made only inside a loop never establishes definite assignment
after the loop; assign the binding before entering the loop when it is needed
afterward. This rule applies to every loop form, regardless of its apparent
condition or `break` statements.

After `try`/`catch`, a binding is definitely assigned only if the normal exit
of the `try` body and every normal `catch` exit assign it. `finally` is then
analyzed on those exits: an assignment it performs establishes the binding
after the construct if the `finally` itself completes normally. A `finally`
that throws, returns, breaks, or continues has no normal exit through that
path.

A closure may capture a local binding only when that binding is definitely
assigned at the closure expression. This deliberately avoids reasoning about
when a callback is invoked. `global`, `context`, imported names, and instance
or static properties are resolved by their own declarations and are not local
definite-assignment facts.

File-level globals use the declaration form `global name = expression`. A
function or method accesses one with an explicit `global name` declaration.
This makes shared mutable state visible at both its declaration and point of
use.

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

**Status:** Accepted

`@name` denotes an instance property and `@@name` denotes a static property.
They are never local variables. A class `properties` section declares the
public instance-property surface; the names listed there are accessed internally
as `@name` and externally through normal JavaScript property access.

An `@` property that is not listed in `properties` is private to the Lango class
contract. JavaScript cannot enforce this for interoperable objects, so privacy
is checked by the Lango compiler rather than by a JavaScript private field.

The `properties` section declares API only: it supplies neither a type nor an
initializer. A public property therefore need not be initialized by every
constructor path. A property read is valid only when its member name is known:
a public name is known through `properties`, while a private or protected name
is known through an assignment somewhere in its declaring class. A known but
not-yet-assigned property reads as `null`; an unknown property read is a
compile-time error. First assignment creates the property's storage, so private
and protected properties may be initialized lazily.

## D-006: Relaxed JSON object literals compile to plain objects

**Status:** Accepted

`{}` creates a JavaScript object. D-044 defines its line-oriented field syntax:
fields are newline-separated, not comma-separated. Unquoted identifier keys and
quoted string keys are both valid. Dot and bracket access have their JavaScript
meanings:

```lango
person = {
    name: "Savaş"
    age: 42
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

Text equality follows the text comparison policy described in D-011. Decimal
equality follows D-038.

## D-011: Quote style carries text intent

**Status:** Accepted

Single-quoted literals are programmatic strings. Double-quoted literals are
texts: they are eligible for translation extraction and support interpolation.
Both compile to JavaScript strings.

Interpolation has one spelling, `${expression}`, in a double-quoted text.
Programmatic strings compare by exact, case-sensitive Unicode code points.
Texts compare by first applying Unicode NFC normalization and then Unicode
default case folding. The compiler supplies this operation; it must not inherit
the host machine's locale. Therefore `"I" == "i"` is true, while `"I" == "ı"`
and `"İ" == "i"` are false. Locale-specific Turkish casing never changes the
meaning of `==`.

After macro expansion, the compiler extracts texts into JSON translation
catalogs. A text's canonical source template is its default message key and its
fallback display value. Interpolations are replaced in source order by `{0}`,
`{1}`, and so on; a translation may reorder or repeat those placeholders. In a
catalog template, literal braces are escaped as `{{` and `}}`. Missing
translations display the source template. The host chooses a catalog; source
code does not select a locale. Plural rules, grammatical gender or context,
custom message IDs, and catalog-loading policy are outside the core language
and may be supplied by libraries.

Triple double quotes create a multiline text. The opening delimiter must end
its physical line and the closing delimiter must be the only non-whitespace
content on its line; `"""text"""` is invalid. The line terminator immediately
after the opening delimiter and the line terminator immediately before the
closing delimiter are not part of the value. From every remaining nonblank line,
the compiler removes the shared minimum leading-space indentation. Whitespace
on otherwise blank lines is removed. The closing delimiter's column has no
effect on the value, so formatting a surrounding block cannot change the text.
Use explicit escapes such as `\n` and `\t` when a leading/trailing newline or
particular indentation is semantically required.

## D-012: Closures make nonlocal local bindings explicit

**Status:** Accepted

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

Each closure declares its own direct external dependencies. An inner closure
therefore captures a local even if an enclosing closure also captures it; a
capture is a shared binding, not a value snapshot, so a closure may mutate it.
The same rule applies to protected properties, written `capture _property`.

`for collection as item` creates a fresh `item` binding for every iteration.
A closure created in that iteration captures that iteration's binding. By
contrast, a binding declared outside a `loop` remains one shared binding and
closures observe its later mutations.

Within a closure, `global name` and `context name` must be declared again when
those bindings are used; imported names remain directly available. Every
`capture` declaration must precede ordinary closure statements and must name a
binding actually used by that closure. An implicit local capture is a
compile-time `MissingCapture` diagnostic that identifies the name and suggests
its `capture name` declaration. Destructuring has no separate rule because it
is not Lango syntax.

## D-013: Context is dynamically scoped, immutable binding state

**Status:** Accepted

`context name = value` establishes or shadows a named context binding for the
remainder of the current dynamic call scope. When that scope returns or throws,
the prior binding is restored. `context name` declares that a function reads
the binding; after that declaration, `name` reads the current context value.

Context values cannot be assigned through a bare `name = value` assignment.
Another `context name = value` creates a nested binding instead. A read of an
unavailable context binding is a runtime error with the requested context name.
The binding itself is immutable, although an object held as its value may still
be mutated through that object.

The context runtime is a synchronous dynamic binding stack. Each Lango function
activation pushes its context changes and restores them with generated
`try`/`finally` cleanup when that activation returns or throws. Recursive and
re-entrant calls therefore create independent nested layers. A JavaScript API
which invokes a Lango callback synchronously before the current call stack
unwinds sees the active context. A callback invoked later by a Promise, timer,
event, or another asynchronous mechanism sees no context from its registration
site; it must receive needed values through an explicit local `capture`.

This model needs neither Node `AsyncLocalStorage` nor a browser-specific
propagation mechanism. It is the same on every JavaScript host and does not
attempt to retain context through uninstrumented asynchronous JavaScript code.

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

**Status:** Accepted

`@name` is a private instance property, `@@name` is a static property, and
`_name` is a protected instance property. `_name` is a class member rather than
a lexical local binding, even though it does not carry the `@` sigil. It may be
used by the declaring class and its descendants, but not by unrelated code.

Names in the `properties` section form the externally accessible instance
property API. A protected name may be shown there for documentation, but it does
not become public through that listing. There are no protected static properties:
`@@_name` is invalid rather than a second spelling for a static member. Static
properties use `@@name` and follow the same known-name and lazy-initialization
rules as other class properties.

## D-019: Inheritance uses an ancestor class and `super`

**Status:** Accepted

`class Child : Parent` declares single inheritance. Re-declaring an inherited
method in `Child` overrides it. `super` accesses the ancestor implementation,
including its constructor where applicable; it never refers to a derived class.

Lango has single inheritance only. Multiple inheritance, mixins, and interfaces
are not core language features. In a class with an ancestor, a written
constructor must call `super(...)` exactly once as its first executable
statement, before any `@` or `_` property access. A class without a written
constructor receives an implicit constructor that forwards its construction
arguments to the ancestor. `super(...)` calls only the ancestor constructor;
`super.method(...)` calls only an ancestor instance method, and `super` is not
a first-class value.

A child inherits public and protected instance members and cannot access an
ancestor's private members. An override of a public or protected method cannot
narrow its visibility; declaring a child method with an ancestor private method's
name is a compile-time error. The public API declared by an ancestor is inherited
automatically, so a child declares only its new or overridden public members.

Static lookup follows JavaScript `class extends` behavior: a child finds its own
static member first and otherwise its ancestor's. Assigning a static member in a
child creates or updates the child's own member and can shadow an inherited one.

## D-050: Static values replace enums

**Status:** Accepted

Lango has no `enum` construct. A class declares initialized public static values
with a `static` section:

```lango
class Color
    static
        White = Color(255, 255, 255)
        Black = Color(0, 0, 0)
```

Each entry is evaluated once, in source order, when the class is defined. It is
an ordinary static property: source outside the class accesses `Color.White`,
and class code accesses `@@White`. Static values remain mutable under D-030,
use ordinary instance identity equality, and serialize as ordinary values. There
is no closed-member rule, exhaustive `switch` analysis, generated `values()`
API, or enum-specific constructor restriction.

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

There are no implicit value conversions, except for the numeric promotion that
D-038 defines inside a Decimal context. Text is composed with interpolation
rather than string concatenation. `and`, `or`, and `not` require Boolean
operands; `and` and `or` short-circuit and produce a Boolean result. D-010
continues to define `==` as non-coercive equality.

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

An ordinary `try`/`catch` catches only an exception thrown synchronously while
the protected expression is evaluated or while a Promise is created. It does
not catch a rejection delivered later by that Promise; a chain's `.catch(...)`
handles that rejection. A rejected Promise returned from `main` is reported as
a failed program outcome under D-035. A detached rejection is left to the host
runtime's normal unhandled-rejection reporting; the transpiler does not attach
a hidden handler.

Lango preserves a JavaScript error object and its stack rather than constructing
an artificial asynchronous stack. Generated source maps may improve reported
source locations when the selected output target supports them. Promise
cancellation, scheduling, and concurrent-handler ordering are not core Lango
features: they follow the JavaScript Promise and library API in use.

Dynamic `context` does not cross a Promise callback boundary automatically. A
callback runs without the context active when it was registered. Code that needs
a context value later reads it into a local binding before registering the
callback and explicitly `capture`s that binding.

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

## D-031: Resources are released with explicit `try`/`finally`

**Status:** Accepted

Lango has no core `defer`, `using`, or resource-scope construct. Code releases
files, database transactions, subscriptions, locks, and similar resources by
calling the resource's own cleanup method in a `finally` block. Libraries define
their cleanup surface, such as `close()` or `dispose()`; the language does not
impose one universal resource interface.

`finally` runs whether the protected block completes normally, returns, or
throws, subject to the ordinary JavaScript `finally` behavior when the `finally`
block itself changes control flow.

## D-032: Built-in collection syntax is deliberately small

**Status:** Accepted

Arrays, plain objects, programmatic strings, and texts are Lango's built-in
collection surface. `for collection as item` iterates arrays, strings, texts,
and other ordinary JavaScript iterable values. `for object as key: value`
iterates the own enumerable entries of a plain object.

`Map`, `Set`, and other JavaScript collection types remain usable through normal
JavaScript interoperation and their native methods, but receive no special
Lango literal, member, or iteration syntax. A `Map` used as a generic iterable
therefore yields its native entry values rather than gaining implicit key/value
destructuring. Generators and `yield` are not introduced by this decision.

String and text indexing, `length`, and single-value iteration use Unicode code
points, not JavaScript UTF-16 code units and not grapheme clusters. Indices are
zero-based; an out-of-range index produces `null` under D-037. The transpiler
uses helpers where JavaScript's native string operations would split a surrogate
pair. Text equality's D-011 normalization and case folding apply only while
comparing values; they do not rewrite stored text or change its code-point
length or indexing.

## D-033: Programs start in an exported `main(args)` function

**Status:** Accepted

An entry source file declares and exports `main(args)` as its program entry
point. The host starts the program by calling that exported function with its
argument array. A library source file need not declare `main`.

At source-root indentation, only declarations are valid: imports, exports,
classes, functions, macros, globals, contexts, and tests. A free executable
statement at root indentation is a compile-time error. Executable code belongs
inside a function, method, test, or macro body. A declaration may contain an
initializer where its own syntax permits one, such as `global name = value`.

The precise host contract for environment configuration, returned Promises, and
exit codes remains open work.

## D-034: Entry arguments are a host-supplied string array

**Status:** Accepted

The `args` parameter of exported `main(args)` is an array of programmatic
strings supplied by the host. It contains only program arguments and excludes
the executable name and entry-source/module name. A Node host maps this to the
equivalent of `process.argv.slice(2)`; a browser or embedded host supplies its
own array. Lango has no global argument variable.

## D-035: `main` completion determines program outcome

**Status:** Accepted

When `main(args)` completes without throwing, the program succeeds. If it
returns a number, a command-line host uses that number as its exit code; a host
without an exit-code concept ignores the numeric result. A value of any other
kind has no special host meaning. An uncaught error from `main` is a failed
program outcome and is reported by the host.

If `main` returns a JavaScript Promise, the host follows that Promise to
completion before applying these outcome rules to its resolved value. A rejected
`main` Promise is a failed program outcome. This is an entry-host lifecycle
rule; it does not alter how Promise-returning calls behave in Lango source code.

A Promise created by `main` but not returned from it is detached work. The host
does not track it, wait for it, use it to determine the exit code, or convert
its rejection into the `main` outcome. Whether detached work keeps a process
alive follows the underlying host runtime. Its lifecycle and rejection handling
are the program author's responsibility.

## D-036: Host selection is outside Lango source

**Status:** Accepted

The compiler invocation or embedding host selects the target environment, such
as Node, browser, test runner, or database adapter. Lango source does not select
or branch on its host through a core keyword, and the language provides no
implicit `env`, `process`, `window`, or equivalent host global.

Programs access host services through explicitly imported libraries, the
`main(args)` argument array, or explicitly declared context bindings. Host
configuration belongs to the compiler, host, or library layer rather than the
core language.

## D-037: `null` is Lango's sole absence value

**Status:** Accepted

Lango has one absence value, `null`. It does not expose JavaScript `undefined`
as a separate Lango value. At a JavaScript interoperability boundary, an
`undefined` result is normalized to `null`; reading a missing object property
also produces `null`.

Optional chaining is not part of the language. D-010's strict `==` equality
means `value == null` is the explicit and sufficient absence test, so the
standard library provides no `is_null()` helper.

## D-038: `$` marks explicit Decimal bindings and contexts

**Status:** Accepted

An ordinary Lango number is a native JavaScript `Number`. A `$name` binding,
parameter, or property is a Decimal value. The marker composes with existing
property sigils: `@$name`, `@@$name`, and `_$name` are Decimal instance, static,
and protected properties. `global $name = value` declares a Decimal global.
Decimal values are backed by a decimal runtime selected by the transpiler, not
by a package name exposed in Lango source. D-049 fixes that runtime for the
current compiler.

A numeric literal assigned to a `$` binding/property is emitted directly as a
Decimal literal, without first becoming a JavaScript floating-point value. An
assignment to a `$` binding/property, an expression containing a `$` Decimal
value, or an argument supplied to a `$` parameter is a Decimal context. Its
finite native Number operands and numeric literals are promoted to Decimal by
the selected runtime. Arithmetic, ordering, and numeric equality in that context
are lowered to the library-independent decimal protocol:

```lango
$total = $price + quantity + 2.5
```

The result of Decimal arithmetic is Decimal. It may be assigned only to a `$`
binding/property, returned from a Decimal-returning function, or passed to a
`$` parameter. Assigning it to an unmarked binding/property is a compile-time
error, so Decimal values do not become invisible after an expression.

Functions that accept Decimal values declare `$` parameters. The compiler
infers a Decimal return from Decimal return expressions, and a call with that
result must be used in a Decimal-compatible position. Passing a Decimal to an
unmarked Lango parameter is a compile-time error. `to_js_number($decimal)` is
the explicit escape to native Number and may lose precision; it is intended for
JavaScript-library boundaries. `is_number(value)` is true for both Number and
Decimal values.

When source contains no `$` Decimal binding, parameter, or property, the
transpiler emits ordinary native JavaScript Number operations and does not
include the Decimal runtime helper.

## D-043: `$` also marks Decimal object and JSON fields

**Status:** Accepted

A plain-object property named `$name` is a Decimal field. Source object literals
such as `{ $price: 12.50 }` create an exact Decimal value for that field, and
`object.$price` is a Decimal expression. The field name, including its `$`, is
preserved when the object is passed to JavaScript or serialized as JSON.

`from_json` recognizes a numeric JSON field whose key begins with `$` as a
Decimal field and sends its raw numeric token directly to the Decimal backend.
This preserves precision that a native JavaScript JSON parse would lose. A `$`
JSON field must contain a JSON number; another JSON value is a parse error.
`to_json` serializes a Decimal as a JSON number using the Decimal backend's
canonical decimal spelling.

A normal JSON field remains a native Number. Assigning it to a `$` binding uses
D-042's Number-to-Decimal conversion, which cannot restore precision that was
already lost while parsing the normal JSON field.

Lango provides no alternate `from_json` mode, field-path selector, or external-
schema annotation that preserves raw numeric tokens for ordinary field names.
An external JSON schema without `$` Decimal field names is intentionally parsed
as native Numbers first; assigning `order.price` to `$price` performs the
ordinary D-042 conversion at that point. This favors one simple JSON entry point
over retaining precision that JavaScript Number parsing has already lost.

## D-039: Decimal division uses a configured fractional scale

**Status:** Accepted

Decimal addition, subtraction, and multiplication preserve an exact arbitrary-
precision decimal result. Decimal division rounds its result to the
`decimal_division_scale` compiler-profile setting, measured in digits after the
decimal separator. The default scale is six, so `$one / $three` produces
`3.333333`. The `decimal_division_rounding` compiler-profile setting selects the
rounding mode and defaults to `half_even`. A finite result with more than the
configured fractional digits is rounded by that mode. Division by zero is a
runtime error.

The compiler profile records its division scale and rounding mode and is used
unchanged by builds and tests, so a program's numeric result is reproducible.
Lango provides no per-operation rounding API. Native JavaScript Number arithmetic
continues to follow JavaScript semantics.

## D-040: Lango numbers are always finite

**Status:** Accepted

`NaN`, `Infinity`, and `-Infinity` are not Lango number values and have no
Lango literal spelling. A native Number arithmetic operation that produces a
non-finite result raises a `NonFiniteNumber` runtime error. A non-finite Number
returned by JavaScript interoperation, or produced by `to_js_number($decimal)`,
raises the same error before becoming observable to Lango code.

Decimal values are finite by their runtime contract. `is_number(value)` is true
only for a finite native Number or a valid Decimal value.

## D-041: Numeric literals are decimal, scientific, or hexadecimal

**Status:** Accepted

Lango supports base-10 integer and fractional literals such as `12` and
`12.50`, scientific-notation literals such as `1.2e3`, and hexadecimal integer
literals such as `0xFF`. The `e` exponent marker and hexadecimal digits are
case-insensitive. A leading sign is the ordinary unary operator rather than
part of a literal.

Binary and octal literals, numeric separators, and other JavaScript numeric
literal forms are not part of Lango. A literal assigned to a `$` Decimal binding
is converted from its source spelling directly by the Decimal backend; a
hexadecimal Decimal literal therefore becomes its exact base-10 integer value.

## D-042: Number–Decimal conversion has explicit boundary semantics

**Status:** Accepted

When D-038 promotes a finite native JavaScript Number into a Decimal context,
the Decimal backend receives the Number's canonical shortest decimal string that
round-trips to the same JavaScript Number. Therefore a native `0.1` becomes the
Decimal value `0.1`, rather than the Number's hidden binary expansion. The
backend may receive scientific notation where that is JavaScript's canonical
spelling.

`to_js_number($decimal)` converts a Decimal to the nearest finite JavaScript
Number. Precision loss is permitted because this conversion is explicit in
source. A conversion that cannot produce a finite Number raises the D-040
`NonFiniteNumber` error.

## D-044: Delimiters are line-oriented outside single-line lists

**Status:** Accepted

Braces always introduce an object literal expression; they never introduce a
statement block. Object fields use `key: value`, with either a bare identifier
(including a `$` Decimal field name) or a quoted-text key. An object has at
most one field per physical line. Newlines separate its fields; commas,
including a trailing comma, are invalid in object literals. Repeated object
keys are a compile-time error. Computed keys and object-spread syntax are not
part of Lango.

An array whose members occupy one physical line uses commas, such as `[1, 2,
3]`. A multiline array has exactly one member per line and uses no commas,
including after its final member. This makes a newline the unambiguous separator
for multiline data literals.

Function parameter and argument lists retain comma separators only when the
whole list is on one physical line. Multiline parameter and argument lists are
not currently Lango syntax; they are deliberately deferred rather than given a
second separator rule.

## D-045: JavaScript calls preserve native receiver and argument behavior

**Status:** Accepted

A call to a statically known Lango function or method follows D-025's arity and
default-parameter rules. A call to an imported or dynamically obtained
JavaScript function passes its positional arguments through unchanged; its
handling of missing or excess arguments is the JavaScript API's own contract.
An array is never expanded implicitly at either boundary.

`object.method(arguments)` invokes a JavaScript method with `object` as its
receiver. An imported JavaScript method may be read as a function value, but
doing so preserves JavaScript's ordinary unbound-receiver behavior. Source that
needs the receiver creates an explicit closure which calls the method through
the object. D-027's stricter ban on detaching Lango instance methods remains in
effect.

Calling a value that is not callable raises the Lango runtime error
`NotCallable`. Native JavaScript values otherwise cross the boundary unchanged,
subject to the existing Lango normalizations: JavaScript `undefined` becomes
Lango `null`, D-040 rejects non-finite numbers, and a Decimal must use
`to_js_number` before it enters an ordinary JavaScript numeric API. A JavaScript
exception value propagates unchanged through Lango. JavaScript constructors and
subclassing are outside this decision.

## D-049: Decimal uses a pinned embedded `bignumber.js` runtime

**Status:** Accepted

The compiler vendors `bignumber.js` version 11.1.5 as Lango's Decimal runtime;
Lango source never imports, configures, or observes that package. This library
matches Lango's numeric contract: addition, subtraction, and multiplication
remain exact, while division uses a decimal-place scale and rounding mode.

For each compiler profile, the transpiler creates an isolated `BigNumber.clone`
configuration rather than mutating global library settings. It maps
`decimal_division_scale` and `decimal_division_rounding` to that clone, including
the default scale of six and `half_even` mode. D-040 checks still prevent
non-finite values from becoming Lango numbers.

There is no pluggable Decimal-backend interface in the first compiler. Decimal
regression tests operate at the Lango semantic level and cover the pinned runtime
through literals, conversion, arithmetic, division ties, comparison, JSON,
serialization, and non-finite boundaries. Replacing the embedded library later
requires preserving those language-level results; it does not expose a backend
choice to source programs.

## D-046: Decimal core has no general math-function surface

**Status:** Accepted

Decimal contexts support the four arithmetic operators `+`, `-`, `*`, and `/`,
unary sign, ordering, and numeric equality as defined by D-038 and D-039.
Decimal modulo and a core Decimal `Math` surface are not part of Lango:
there is no Decimal `pow`, `sqrt`, trigonometry, `floor`, `ceil`, or source-
level `round` operation. In particular, D-039's compiler-profile division
rounding remains the language's only built-in Decimal rounding point.

Advanced numerical work uses an imported JavaScript library with an explicit
`to_js_number($value)` boundary. Assigning that finite Number result to a `$`
binding converts it back under D-042, making any native-number precision loss
visible at the source boundary. Ordinary native Number expressions retain their
normal JavaScript arithmetic surface, subject to D-040.

## D-047: Decimal SQL parameters never narrow to native Number

**Status:** Accepted

When a `$` Decimal value is assigned to an `SQL` literal's named parameter, the
transpiler passes the database adapter its canonical decimal text together with
a `decimal` type tag. It never first converts that value to a JavaScript Number.
The adapter binds it through the database driver's Decimal/numeric mechanism;
an adapter or driver that cannot do this reports an error rather than silently
losing precision. Native Number parameters remain native Numbers, and `null`
binds as SQL `NULL`. This decision concerns input parameters only; SQL result
column representation remains part of the embedded-SQL contract.

## D-048: Decimal-returning functions are inferred consistently

**Status:** Accepted

A Lango function or source-visible closure is Decimal-returning when any
reachable value-return expression is Decimal. Every other normally returning
path of that function must then return a Decimal too; a native Number, `null`,
or valueless normal return mixed with a Decimal return is a compile-time error.
The compiler computes this property to a fixed point across direct and mutually
recursive Lango functions, including across resolved Lango modules.

A call to a known Decimal-returning function produces a Decimal result and must
be used in a Decimal-compatible position under D-038, unless its result is
discarded. The same inference applies to an inline closure whose source is
visible to the compiler.

The result of a dynamically obtained JavaScript function or a statically
unknown higher-order callback is not inferred as Decimal. Assigning such a
result to a `$` binding uses the ordinary Number-to-Decimal boundary conversion
when it is a native Number; source does not assume an untyped callback preserves
Decimal identity.
