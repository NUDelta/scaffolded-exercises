/*
    Makes the following modifications to source code before rewriting it to `updated_<orig_file_name>.js`:
        - deanonymizes anonymous functions with variable declarators
*/

const recast = require("recast");
const b = recast.types.builders;
const fs = require("fs");
const esprima = require("esprima");

// const fileKey = "mapstd_src";
const fileKey = "xkcd_src";
const scriptString = fs.readFileSync(`./temp/${fileKey}.js`).toString();
// const scriptString = fs.readFileSync("./test_src.js", "utf-8");

function deanonymizeFunctionExpressions(source) {
    let prevUpdated,
        updatedSrc = source;
    let isTraveralComplete = false;
    /* parseTreeAndUpdate makes one change at a time since it shifts around the locations/features of different items in the source code, so need to call it iteratively until all changes are made */
    while (!isTraveralComplete) {
        prevUpdated = updatedSrc;
        updatedSrc = parseTreeAndUpdate(updatedSrc);
        isTraveralComplete = prevUpdated === updatedSrc;
    }
    return updatedSrc;
}

function parseTreeAndUpdate(source) {
    /* make one update then stop so that the next update is done on the newly updated tree. Inefficicent but consistent. */
    let updates = false;
    esprima.parseScript(source, {}, function (node, meta) {
        if (isAnonymizedFunction(node) && updates === false) {
            let startLoc = meta.start.offset;
            let endLoc = meta.end.offset;

            /* check to see if there is a variable declarator and remove it if so */
            let possibleDeclaratorStartLoc = startLoc - 5 > 0 ? startLoc - 5 : 0;
            const possibleDeclarator = source.slice(possibleDeclaratorStartLoc, startLoc);
            if (
                possibleDeclarator.includes("const") ||
                possibleDeclarator.includes("var") ||
                possibleDeclarator.includes("let")
            ) {
                startLoc = possibleDeclaratorStartLoc;
            }

            const deanonymizedFunction = deanonymizeFunctionExpr(node);
            const deanonymizedFunctionStr = recast.print(deanonymizedFunction).code;
            /** replaces the anonymous function with the deanonymized function; this happens recursively
             * so the most up to date souce script is always modified
             */
            source = source.slice(0, startLoc) + deanonymizedFunctionStr + source.slice(endLoc);
            updates = true;
        }
        /* SOURCE SCRIPT EXAMPLE (PSEUDOCODE):
            function..
            function..
            variable..
            CURR NODE TO BE REPLACED
            variable...
            function...
        */
    });
    return source;
}

function isAnonymizedFunction(node) {
    return (
        (node.type === "VariableDeclarator" && node.init.type === "FunctionExpression") ||
        (node.type === "ExpressionStatement" &&
            node.expression === "AssignmentExpression" &&
            node.expression.right === "FunctionExpression")
    );
}
/* SOME FUNCTIONS SHOULD STAY ANONYMOUS... SEE EXAMPLE: 
    var foo = function() {

    } 
    // want to turn ^this variable declaration into a function declaration:
    function foo() {

    }

    // want to keep this function how it is; it is not a named function
    (function() {

    })
*/
function deanonymizeFunctionExpr(node) {
    const functionName = node.id.name ? node.id.name : "REAL_ANON_SOS";
    const newId = b.identifier(functionName);
    const newNode = b.functionDeclaration(newId, node.init.params, node.init.body);
    /** next three lines for debugging purposes to be able to see the deanonymized function printed */
    const recastNode = recast.print(newNode).code;
    const recastNodeFunctionDeclaration = recastNode.split("\n")[0];
    console.log("deanonymizeFunctionExpr: function deanonymized! ", recastNodeFunctionDeclaration);
    return newNode;
}

/** calls the functions above in order to write the updated source code to a file */
let finalUpdate = deanonymizeFunctionExpressions(scriptString);
console.log("updated src");
console.log(finalUpdate);
fs.writeFileSync(`./temp/updated_${fileKey}.js`, finalUpdate);
