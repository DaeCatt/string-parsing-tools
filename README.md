# string-parsing-tools

This is a JavaScript for building better string parsers. Everything included has
JSDoc comments for types.

## Context.js

Helps you use sticky regexes to break down strings. Example:
[parseJSON](examples/parseJSON.js).

Usage:

```javascript
// Create a context
const context = new Context(" c[1,2,3]");

// Match against a simple regex.
const whitespace = context.match(/\s+/y);
// Position inside the context is automatically advanced if a match was found.

// Returns null if regex did not match or matched 0 character.
if (whitespace !== null) {
	// Otherwise whitespace is a map of the Regex result.
	// The map will always have a key `0` with the value of the entire match.
	console.log(`Matched ${JSON.stringify(whitespace.get(0))}.`);
}

// Match against a regex with groups.
const GROUP_RE = /(?<a>a)|(b)|c/y;

const groupMatch = context.match(GROUP_RE);
if (groupMatch !== null) {
	if (groupMatch.has("a")) {
		console.log("matched a");
		// Named group "a" was matched.
	} else if (groupMatch.has(2)) {
		console.log("matched b");
		// Named group "b" was matched.
	} else {
		// No named groups were matched.
		console.log("matched c");
	}
}

// Match against a string.
const stringMatch = context.matchString("[");

// Returns null if there was no match. Otherwise returns the matched string.
if (stringMatch === null) throw new Error(`Expected "[".`);
const ints = [];
if (context.matchString("]") === null) {
	do {
		const int = context.match(/0|[1-9][0-9]*/y);
		if (int === null) throw new Error(`Expected int.`);
		ints.push(parseInt(int.get(0), 10));
	} while (context.matchString(",") !== null);

	if (context.matchString("]") === null) throw new Error(`Expected "]".`);
}

console.log(ints);

// Check if we've parsed all characters in context.
if (!context.atEnd()) throw new Error(`Expected EOF.`);
```

## ABNF.js

Converts a subset of ABNF to regex strings. Requires that rules are specified
before they are referenced and cannot support recursive rules. Example:
[parseHTTPDate](examples/parseHTTPDate-js).
