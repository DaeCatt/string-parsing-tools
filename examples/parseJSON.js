/**
 * A complete implentation of a JSON parser
 */
const Context = require("../index");

const WHITE_SPACE = /[ \t\r\n]+/y;
const NUMBER_RE = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[Ee][+-]?[0-9]+)?/y;
const STRING_CONTENT_RE = /[^"\\\x00-\x1f]|\\(?<escape>["\\\/bfnrt]|u[0-9A-Fa-f]{4})/y;
const ESCAPE_CHAR_MAP = new Map(
	Object.entries({
		'"': '"',
		"\\": "\\",
		"/": "/",
		b: "\b",
		f: "\f",
		n: "\n",
		r: "\r",
		t: "\t",
	})
);

const parseJSONObject = (context) => {
	if (context.matchString("{") === null) return null;

	const object = Object.create(null);
	context.match(WHITE_SPACE);
	if (context.matchString("}") !== null) return object;

	do {
		context.match(WHITE_SPACE);
		const name = parseJSONString(context);
		if (name === null) throw new Error(`Expected object key string.`);
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

const parseJSONArray = (context) => {
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

const parseJSONString = (context) => {
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

const parseJSONNumber = (context) => {
	const match = context.match(NUMBER_RE);
	if (match === null) return null;
	return parseFloat(match.get(0));
};

const parseJSONValue = (context) => {
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

const parseJSONFromString = (string) => {
	const context = new Context(string);

	// Trim whitespace at start of document
	context.match(WHITE_SPACE);
	const result = parseJSONValue(context);

	// Trim whitespace at end of document
	context.match(WHITE_SPACE);

	if (!context.atEnd()) throw new Error("Invalid JSON document.");
	return result;
};

module.exports = parseJSONFromString;
