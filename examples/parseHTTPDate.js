/**
 * A simple HTTP Date Parser
 */

const Context = require("../Context");
const ABNF = require("../ABNF");

const MONTHS = "JAN/FEB/MAR/APR/MAY/JUN/JUL/AUG/SEP/OCT/NOV/DEC".split("/");
const rules = ABNF`
day     =  "Mon" / "Tue" / "Wed" / "Thu" / "Fri" / "Sat" / "Sun"
date    =  "0" ("1" / "2" / "3" / "4" / "5" / "6" / "7" / "8" / "9")
           / ( "1" / "2" ) DIGIT
           / "3" ( "0" / "1" )
month   =  ${MONTHS} ; Automatically expands to several options of strings.
year    =  4*DIGIT
hour    =  ("0" / "1") DIGIT / "2" ("0" / "1" / "2" / "3")
minute  =  ("0" / "1" / "2" / "3" / "4" / "5") DIGIT
second  =  minute / "60"`;

const re = new Map();
for (const [name, reString] of rules) re.set(name, new RegExp(reString, "y"));

// prettier-ignore
const DATE = "day_, _date_ _month_ _year_ _hour_:_minute_:_second_ GMT".split("_");

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
