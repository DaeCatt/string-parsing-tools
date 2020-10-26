/**
 * Helper class for parsing strings
 */
"use strict";

module.exports = class Context {
	string = "";
	index = 0;

	/**
	 * Construct a context object.
	 * @param {string} string
	 * @param {number=} index
	 */
	constructor(string, index = 0) {
		if ("string" !== typeof string)
			throw new TypeError(`string must be a string.`);

		if ("number" !== typeof index)
			throw new TypeError(
				`index must be an integer between 0 and the length of the string.`
			);

		if (!Number.isInteger(index) || index < 0 || index > string.length)
			throw new RangeError(
				`index must be an integer between 0 and the length of the string.`
			);

		this.string = string;
		this.index = index;
	}

	/**
	 * Determine whether the string context is at the end of the string.
	 * @return {boolean}
	 */
	atEnd() {
		return this.index >= this.string.length;
	}

	/**
	 * Match context against an exact string. Returns the matched string on
	 * success, otherwise returns `null`.
	 * @param {string} string
	 * @return {string|null}
	 */
	matchString(string) {
		if ("string" !== typeof string)
			throw new TypeError(`Context.matchString argument must be string.`);

		if (!this.string.startsWith(string, this.index)) return null;

		this.index += string.length;
		return string;
	}

	/**
	 * Match context against a RegExp. Returns a `Map` with the match groups on
	 * success, otherwise returns `null`.
	 * @param {RegExp} regexp RegExp with sticky flag (/y).
	 * @return {Map<number|string,string>|null}
	 */
	match(regexp) {
		if (!(regexp instanceof RegExp))
			throw new TypeError(`Context.match argument must be a RegExp.`);

		if (!regexp.sticky)
			throw new Error(`Context.match RegExp must have sticky flag (/y).`);

		regexp.lastIndex = this.index;
		const exec = regexp.exec(this.string);
		if (exec === null) return null;

		this.index = regexp.lastIndex;

		const result = new Map();
		for (let i = 0; i < exec.length; ++i) {
			if (exec[i] != null) result.set(i, exec[i]);
		}

		if (exec.groups == null) return result;

		for (const [name, value] of Object.entries(exec.groups)) {
			if (value != null) result.set(name, value);
		}

		return result;
	}

	/**
	 * Match context against a RegExp multiple times. Returns a string with
	 * everything matched on success, otherwise returns `null`.
	 * @param {RegExp} regexp RegExp with sticky flag (/y).
	 * @return {string}
	 */
	matchMany(regexp) {
		if (!(regexp instanceof RegExp))
			throw new TypeError(`Context.matchMany argument must be a RegExp.`);

		if (!regexp.sticky)
			throw new Error(
				`Context.matchMany RegExp must have sticky flag (/y).`
			);

		let string = "";
		let count = 0;
		while (true) {
			const match = this.match(regexp);
			if (match == null) break;

			string += match.get(0);
			++count;
		}

		if (count > 0) return string;
		return null;
	}
};
