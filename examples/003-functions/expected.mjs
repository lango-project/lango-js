import {
    println as __println,
    translate as __translate,
} from "./.lango/runtime.mjs";

function greet(name) {
    return __translate("Hello, {0}", [name]);
    return null;
}

export function main(args) {
    let name = "world";
    if (args.length > 0) {
        name = args[0];
    }
    __println(greet(name));
    return null;
}
//# sourceMappingURL=main.mjs.map
