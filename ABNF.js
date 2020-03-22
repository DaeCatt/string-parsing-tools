/**
 * Ideal String Matching
 */
"use strict";
const Context = require("./Context");
const PLACEHOLDER_RULE_PREFIX = "placeholder-rule-";

const CORE_RULES = new Map(
	Object.entries({
		alpha: /[A-Za-z]/,
		bit: /[01]/,
		char: /[\x01-\x7f]/,
		cr: /\r/,
		crlf: /\r\n/,
		ctl: /[\x00-\x1f\x7f]/,
		digit: /[0-9]/,
		dquote: /"/,
		hexdig: /[0-9A-Fa-f]/,
		htab: /\t/,
		lf: /\n/,
		lwsp: /[ \t\n]*/,
		octet: /[\x00-\xff]/,
		sp: /[ ]/,
		vchar: /[\x21-\x7e]/,
		wsp: /[ \t]/
	}).map(([name, regex]) => [name, regex.source])
);

const RULENAME_RE = /[A-Z][A-Z0-9-]*/iy;
const DEFINED_AS_RE = /=\/?/y;
const C_WSP_RE = /[ \t]|(?:;[ \t\x21-\x7e]*)?\n[ \t]/y;
const C_NL_RE = /(?:;[ \t\x21-\x7e]*)?\n/y;
const REPEAT_RE = /(?<min>[0-9]*)\*(?<max>[0-9]*)|(?<exact>[0-9]+)/y;
const CHAR_VAL_RE = /"[\x20-\x21\x23-\x7e]*"/y;
const NUM_VAL_RANGE_RE = /%(?:b[01]+(?:-[01]+)|d[0-9]+(?:-[0-9]+)|x[0-9A-F]+(?:-[0-9A-F]+))/iy;
const NUM_VAL_RE = /%(?:b[01]+(?:\.[01]+)*|d[0-9]+(?:\.[0-9]+)*|x[0-9A-F]+(?:\.[0-9A-F]+)*)/iy;
const PROSE_VAL_RE = /<[\x20-\x3D\x3F-\x7e]*>/y;
const BASE_MAP = new Map(Object.entries({ b: 2, d: 10, x: 16 }));

/**
 * @param {string} string
 * @return {string}
 */
const stringToABNF = string => {
	return (
		'"' +
		string.replace(/"+/g, quotes => {
			if (quotes.length === 1) return '" DQUOTE "';
			return '" ' + quotes.length.toString(10) + '(DQUOTE) "';
		}) +
		'"'
	)
		.replace(/""/g, "")
		.trim();
};

/**
 * @param {string} string
 * @return {string}
 */
const escapeStringForRegExp = string =>
	string.replace(/[\[\]\(\)\{\}\*\+\?\|\^|\$|\.\\]/g, char => `\\${char}`);

const makeRegExpStringCaseInsensitive = string =>
	string.replace(/\p{L}/gu, letter => {
		const u = letter.toUpperCase();
		const l = letter.toLowerCase();
		if (u === l && u === letter) return letter;
		if (u === letter || l === letter) return `[${u}${l}]`;
		return `[${u}${l}${letter}]`;
	});

/**
 * @param {Map<number|string,string>} map
 * @return {string}
 */
const formatRepeat = map => {
	if (map === null) return "";
	if (map.has("exact"))
		return "{" + parseInt(map.get("exact"), 10).toString(10) + "}";

	if (!map.has("min") || !map.has("max"))
		throw new Error("Invalid repeat match map.");

	const min = map.get("min");
	const max = map.get("max");

	if (min === "" && max === "") return "*";
	if (max === "") {
		const minVal = parseInt(min, 10);
		if (minVal === 1) return "+";
		return "{" + minVal.toString(10) + ",}";
	}

	const maxVal = parseInt(max, 10);
	if (min === "") return "{," + maxVal.toString(10) + "}";

	const minVal = parseInt(min, 10);
	if (minVal > maxVal)
		throw new RangeError(
			"minimum repetition is greater than maximum repetition."
		);

	if (minVal === maxVal) return "{" + minVal.toString(10) + "}";

	return "{" + minVal.toString(10) + "," + maxVal.toString(10) + "}";
};

/**
 * @param {number} value
 * @return {string}
 */
const formatCodePoint = value => {
	const hex = value.toString(16);
	if (value > 0xffff) return `\\u{${hex}}`;
	if (value > 0xff) return `\\u${hex.padStart(4, "0")}`;
	return `\\x${hex.padStart(2, "0")}`;
};

/**
 * @param {Context} context
 * @param {Map<string,string>} rules
 * @return {string|null}
 */
const elementToRegExpString = (context, rules) => {
	let match;
	match = context.match(RULENAME_RE);
	if (match !== null) {
		const ruleName = match.get(0).toLowerCase();
		if (CORE_RULES.has(ruleName)) return CORE_RULES.get(ruleName);
		if (rules == null || !rules.has(ruleName))
			throw new Error(`Rule by name "${ruleName}" not in rules map.`);

		return rules.get(ruleName);
	}

	if (context.matchString("(") !== null) {
		context.matchMany(C_WSP_RE);
		let regex = alternationToRegExpString(context, rules);
		context.matchMany(C_WSP_RE);
		if (context.matchString(")") === null) throw new Error(`Expected ")".`);

		return regex;
	}

	if (context.matchString("[") !== null) {
		context.matchMany(C_WSP_RE);
		let regex = "(?:" + alternationToRegExpString(context, rules) + ")?";
		context.matchMany(C_WSP_RE);
		if (context.matchString("]") === null) throw new Error(`Expected "]".`);

		return regex;
	}

	match = context.match(CHAR_VAL_RE);
	if (match !== null) {
		return makeRegExpStringCaseInsensitive(
			escapeStringForRegExp(match.get(0).slice(1, -1))
		);
	}

	match = context.match(NUM_VAL_RANGE_RE);
	if (match !== null) {
		const string = match.get(0).slice(1);
		const base = BASE_MAP.get(string[0]);
		const [start, end] = string.slice(1).split("-");
		const startVal = parseInt(start, base);
		const endVal = parseInt(end, base);

		if (startVal >= endVal)
			throw new Error(
				"Start value in range must be less than end value."
			);

		const startCode = formatCodePoint(startVal);
		const endCode = formatCodePoint(endVal);
		return `[${startCode}-${endCode}]`;
	}

	match = context.match(NUM_VAL_RE);
	if (match !== null) {
		const string = match.get(0).slice(1);
		const base = BASE_MAP.get(string[0]);
		return string
			.slice(1)
			.split(".")
			.map(code => formatCodePoint(parseInt(code, base)))
			.join("");
	}

	match = context.match(PROSE_VAL_RE);
	if (match !== null) {
		return makeRegExpStringCaseInsensitive(
			escapeStringForRegExp(match.get(0).slice(1, -1))
		);
	}

	return "";
};

/**
 * @param {Context} context
 * @param {Map<string,string>} rules
 */
const concatenationToRegExpString = (context, rules) => {
	let count = 0;
	let regex = "";

	do {
		const repeat = formatRepeat(context.match(REPEAT_RE));
		const element = elementToRegExpString(context, rules);
		if (element === "") {
			if (repeat === "" && count > 0) break;

			throw new Error(`Expected element.`);
		}

		count++;

		if (repeat === "") {
			regex += element;
			continue;
		}

		regex += "(?:" + element + ")" + repeat;
	} while (!context.atEnd() && context.matchMany(C_WSP_RE) !== null);

	return regex;
};

/**
 * @param {Context} context
 * @param {Map<string,string>} rules
 * @return {string}
 */
const alternationToRegExpString = (context, rules) => {
	let count = 0;
	let regex = "";
	do {
		if (count > 0) {
			regex += "|";
			context.matchMany(C_WSP_RE);
		}

		regex += concatenationToRegExpString(context, rules);
		count++;
		context.matchMany(C_WSP_RE);
	} while (context.matchString("/") !== null);

	return count === 1 ? regex : "(?:" + regex + ")";
};

/**
 * @param {TemplateStringsArray} array
 * @param {(RegExp|string|string[])[]} args
 * @param {Map<string,string>} rules
 * @return {string}
 */
const taggedTemplateToABNF = (array, args, rules) => {
	/** @type {Map<RegExp,string>} */
	const ruleIDs = new Map();
	let ruleCount = 0;

	let abnf = "";
	for (let i = 0; i < array.length; ++i) {
		abnf += array.raw[i];
		//
		if (i < args.length) {
			const arg = args[i];
			if (arg instanceof RegExp) {
				if (!ruleIDs.has(arg)) {
					const id =
						PLACEHOLDER_RULE_PREFIX + (ruleCount++).toString(10);

					ruleIDs.set(arg, id);
					rules.set(id, arg.source);
				}

				if (!abnf.endsWith(" ")) abnf += " ";
				abnf += ruleIDs.get(arg) + " ";
				continue;
			}

			if (arg.length === 0) continue;

			if ("string" === typeof arg) {
				if (!abnf.endsWith(" ")) abnf += " ";
				abnf += stringToABNF(arg) + " ";
				continue;
			}

			const strings = arg.filter(string => string.length > 0);
			if (strings.length === 0) continue;
			if (!abnf.endsWith(" ")) abnf += " ";
			abnf += "( " + strings.map(stringToABNF).join(" / ") + " ) ";
		}
	}

	return abnf.trim();
};

/**
 * @param {TemplateStringsArray} array
 * @param  {...string|RegExp|string[]} args
 * @return {Map<string,string>}
 */
const ABNF = (array, ...args) => {
	const rules = new Map();
	const abnf = taggedTemplateToABNF(array, args, rules);

	const context = new Context(abnf);
	while (true) {
		let result = context.match(RULENAME_RE);

		if (result == null) {
			context.matchMany(C_WSP_RE);
			if (context.atEnd()) break;
			if (context.match(C_NL_RE) !== null) continue;
			throw new Error("Expected new line.");
		}

		const ruleName = result.get(0).toLowerCase();
		if (CORE_RULES.has(ruleName))
			throw new Error("Cannot redefined core rule.");

		context.matchMany(C_WSP_RE);
		result = context.match(DEFINED_AS_RE);
		if (result == null) throw new Error(`Expected "=" or "=/".`);

		const definedAs = result.get(0);
		if (definedAs === "=/" && !rules.has(ruleName))
			throw new Error(
				`Cannot add alternative to undefined rule "${ruleName}".`
			);

		context.matchMany(C_WSP_RE);

		const elements = alternationToRegExpString(context, rules);
		context.matchMany(C_WSP_RE);

		if (definedAs === "=/") {
			rules.set(ruleName, rules.get(ruleName) + "|" + elements);
		} else {
			rules.set(ruleName, elements);
		}

		if (context.atEnd()) break;
		if (context.match(C_NL_RE) == null) {
			throw new Error("Expected new line.");
		}
	}

	if (!context.atEnd()) throw new Error("Unexpected character.");

	/** @type {Map<string,string>} */
	const abnfSet = new Map();
	for (const [name, string] of rules) {
		if (name.startsWith(PLACEHOLDER_RULE_PREFIX)) continue;

		abnfSet.set(name, string);
	}

	return abnfSet;
};

module.exports = ABNF;
