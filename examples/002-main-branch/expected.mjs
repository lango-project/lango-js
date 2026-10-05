import {
    println as __println,
    translate as __translate,
} from "./.lango/runtime.mjs";

export function main(args) {
    let name = "world";
    if (args.length > 0) {
        name = args[0];
    } else {
        name = "world";
    }
    __println(__translate("Hello, {0}", [name]));
    return null;
}
//# sourceMappingURL=main.mjs.map
