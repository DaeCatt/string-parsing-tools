# string-parsing-tools

This is a JavaScript for building better string parsers. Everything included has
JSDoc comments for types.

## Context.js

Helps you use sticky regexes to break down strings.

```javascript
/**
 * A complete implementation of a JSON parser.
 */
const Context = require("string-parsing-tools/Context");

const WHITE_SPACE = /[ \t\r\n]+/y;
const NUMBER_RE = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[Ee][+-]?[0-9]+)?/y;
const STRING_CONTENT_RE = /[^"\\]|\\(?<escape>["\\\/bfnrt]|u[0-9A-Fa-f]{4})/y;
const ESCAPE_CHAR_MAP = new Map(
	Object.entries({
		'"': '"',
		"\\": "\\",
		"/": "/",
		b: "\b",
		f: "\f",
		n: "\n",
		r: "\r",
		t: "\t"
	})
);

const parseJSONObject = context => {
	if (context.matchString("{") === null) return null;

	const object = Object.create(null);
	context.match(WHITE_SPACE);
	if (context.matchString("}") !== null) return object;

	do {
		context.match(WHITE_SPACE);
		const name = parseJSONString(context);
		context.match(WHITE_SPACE);
		if (context.matchString(":") === null) throw new Error(`Expected ":".`);

		context.match(WHITE_SPACE);
		const value = parseJSONValue(context);
		object[name] = value;
		context.match(WHITE_SPACE);
	} while (context.matchString(",") !== null);

	if (context.matchString("}") === null) throw new Error(`Expected "}"`);
	return object;
};

const parseJSONArray = context => {
	if (context.matchString("[") === null) return null;

	const array = [];
	context.match(WHITE_SPACE);
	if (context.matchString("]") !== null) return array;

	do {
		context.match(WHITE_SPACE);
		array.push(parseJSONValue(context));
		context.match(WHITE_SPACE);
	} while (context.matchString(",") !== null);

	if (context.matchString("]") === null) throw new Error(`Expected "]"`);
	return array;
};

const parseJSONString = context => {
	if (context.matchString('"') === null) return null;
	let string = "";
	let match;
	while ((match = context.match(STRING_CONTENT_RE)) !== null) {
		if (match.has("escape")) {
			const escaped = match.get("escape");
			if (ESCAPE_CHAR_MAP.has(escaped)) {
				string += ESCAPE_CHAR_MAP.get(escaped);
				continue;
			}

			string += String.fromCodePoint(parseInt(escaped.slice(1), 16));
			continue;
		}

		string += match.get(0);
	}

	if (context.matchString('"') === null) throw new Error(`Expected '"'.`);
	return string;
};

const parseJSONNumber = context => {
	const match = context.match(NUMBER_RE);
	if (match === null) return null;
	return parseFloat(match.get(0));
};

const parseJSONValue = context => {
	if (context.matchString("null") !== null) return null;
	if (context.matchString("false") !== null) return false;
	if (context.matchString("true") !== null) return true;

	const number = parseJSONNumber(context);
	if (number !== null) return number;

	const string = parseJSONString(context);
	if (string !== null) return string;

	const array = parseJSONArray(context);
	if (array !== null) return array;

	const object = parseJSONObject(context);
	if (object !== null) return object;

	throw new Error("Expected value.");
};

const parseJSONFromString = string => {
	const context = new Context(string);

	// Trim whitespace at start of document
	context.match(WHITE_SPACE);
	const result = parseJSONValue(context);

	// Trim whitespace at end of document
	context.match(WHITE_SPACE);

	if (!context.atEnd()) throw new Error("Invalid JSON document.");
	return result;
};
```

## ABNF.js

Converts a subset of ABNF to regex strings. Requires that rules are specified
before they are referenced and cannot support recursive rules.

```javascript
/**
 * A simple HTTP Date Parser
 */
const Context = require("string-parsing-tools/Context");
const ABNF = require("string-parsing-tools/ABNF");

const MONTHS = "JAN/FEB/MAR/APR/MAY/JUN/JUL/AUG/SEP/OCT/NOV/DEC".split("/");
const rules = ABNF`
day     =  "Mon" / "Tue" / "Wed" / "Thu" / "Fri" / "Sat" / "Sun"
date    =  "0" ("1" / "2" / "3" / "4" / "5" / "6" / "7" / "8" / "9")
           / ( "1" / "2" ) DIGIT
           / "3" ( "0" / "1" )
month   =  ${MONTHS} ; Automatically expands to alternation of strings.
year    =  4*DIGIT
hour    =  ("0" / "1") DIGIT / "2" ("0" / "1" / "2" / "3")
minute  =  ("0" / "1" / "2" / "3" / "4" / "5") DIGIT
second  =  minute / "60"`;

const re = new Map();
for (const [name, reString] of rules) re.set(name, new RegExp(reString, "y"));

// prettier-ignore
const DATE = [ "day", ", ", "date", " ", "month", " ", "year", " ", "hour", ":", "minute", ":", "second", " GMT" ];

const parseHTTPDate = string => {
	const context = new Context(string);
	const values = {};
	for (const token of DATE) {
		if (re.has(token)) {
			const value = context.match(re.get(token));
			if (value === null) throw new Error(`Expected ${token}.`);
			values[token] = value.get(0);
		} else {
			if (context.matchString(token) === null)
				throw new Error(`Expected "${token}".`);
		}
	}

	return new Date(
		parseInt(values.year, 10),
		MONTHS.indexOf(values.month.toUpperCase()),
		parseInt(values.date, 10),
		parseInt(values.hour),
		parseInt(values.minute),
		parseInt(values.second)
	);
};
```
