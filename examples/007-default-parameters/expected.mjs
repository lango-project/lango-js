import {
    println as __println,
    boundary as __boundary,
    requireArity as __requireArity,
} from "./.lango/runtime.mjs";

function greet(name, prefix = "Hello") {
    __requireArity(arguments.length, [0], "greet");
    name = __boundary(name);
    prefix = __boundary(prefix);
    return `${prefix}, ${name}`;
    return null;
}

export function main(args) {
    __requireArity(arguments.length, [0], "main");
    args = __boundary(args);
    __println(greet("Savaş"));
    __println(greet("Savaş", "Merhaba"));
    return null;
}
//# sourceMappingURL=main.mjs.map
