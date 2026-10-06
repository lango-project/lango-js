import {
    println as __println,
    translate as __translate,
    requireBoolean as __requireBoolean,
    normalize as __normalize,
    requireArity as __requireArity,
} from "./.lango/runtime.mjs";

function greet(name) {
    __requireArity(arguments.length, [0], "greet");
    return __translate("Hello, {0}", [name]);
    return null;
}

export function main(args) {
    __requireArity(arguments.length, [0], "main");
    let name = "world";
    if (__requireBoolean(__normalize(args.length) > 0)) {
        name = __normalize(args[0]);
    }
    __println(greet(name));
    return null;
}
//# sourceMappingURL=main.mjs.map
