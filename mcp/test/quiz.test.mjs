import { test } from "node:test";
import assert from "node:assert/strict";
import { coerceCorrectAnswer, createQuizStore, lintOptions, normalizeOptions, QuizError } from "../src/quiz.mjs";

const noShuffle = { random: () => 0.999999 }; // Fisher-Yates with j = i keeps order

const planets = {
	question: "Which planet is closest to the Sun?",
	options: [
		{ label: "Mercury", value: "mercury" },
		{ label: "Venus", value: "venus" },
		{ label: "Mars", value: "mars" },
	],
	correctAnswer: "mercury",
	explanation: "Mercury orbits at about 0.39 AU.",
	concept: "inner-planets",
	shuffle: false,
};

test("create hides the answer and letters options in display order", () => {
	const store = createQuizStore(noShuffle);
	const res = store.create(planets);
	assert.equal(res.quizId, "q1");
	assert.deepEqual(
		res.options.map((o) => `${o.key}:${o.label}`),
		["A:Mercury", "B:Venus", "C:Mars"],
	);
	assert.equal(res.dontKnowOption, "I don't know");
	const text = JSON.stringify(res);
	assert.ok(!text.includes("0.39 AU"), "explanation must not leak");
	assert.ok(!text.includes("correct"), "no answer key in create result");
});

test("grading by letter, label, and case-insensitive label", () => {
	for (const sel of ["A", "a.", "Mercury", "  mercury ", "A. Mercury"]) {
		const store = createQuizStore(noShuffle);
		const { quizId } = store.create(planets);
		assert.equal(store.grade({ quizId, selected: sel }).verdict, "correct", sel);
	}
});

test("wrong answer reports the chosen distractor and feedback", () => {
	const store = createQuizStore(noShuffle);
	const { quizId } = store.create(planets);
	const res = store.grade({ quizId, selected: "B", note: "I mixed up hottest and closest" });
	assert.equal(res.verdict, "incorrect");
	assert.deepEqual(res.distractorsChosen.map((o) => o.value), ["venus"]);
	assert.deepEqual(res.correct.map((o) => o.key), ["A"]);
	assert.equal(res.note, "I mixed up hottest and closest");
	assert.match(res.feedback, /✓ A\. Mercury/);
	assert.match(res.feedback, /✗ B\. Venus ← your answer/);
	assert.match(res.feedback, /0\.39 AU/);
});

test("I don't know is a distinct verdict, not incorrect", () => {
	const store = createQuizStore(noShuffle);
	const { quizId } = store.create(planets);
	const res = store.grade({ quizId, selected: "i don't know" });
	assert.equal(res.verdict, "dont_know");
	assert.equal(res.distractorsChosen.length, 0);
});

test("grading is keyed to the shuffled order the learner saw", () => {
	// random() = 0 always swaps with index 0 -> deterministic non-identity order
	const store = createQuizStore({ random: () => 0 });
	const res = store.create({ ...planets, shuffle: true });
	const mercury = res.options.find((o) => o.label === "Mercury");
	assert.notEqual(mercury.key, "A", "test precondition: shuffle moved the answer");
	assert.equal(store.grade({ quizId: res.quizId, selected: mercury.key }).verdict, "correct");
});

test("multi-select requires the exact set", () => {
	const store = createQuizStore(noShuffle);
	const q = {
		question: "Which are prime?",
		options: [{ label: "2" }, { label: "3" }, { label: "4" }, { label: "9" }],
		correctAnswer: '["2", "3"]', // stringified array, as some harnesses send it
		multiSelect: true,
		explanation: "2 and 3 have no divisors other than 1 and themselves.",
		shuffle: false,
	};
	const a = store.create(q);
	assert.equal(store.grade({ quizId: a.quizId, selected: ["A", "B"] }).verdict, "correct");
	const b = store.create(q);
	const partial = store.grade({ quizId: b.quizId, selected: ["A"] });
	assert.equal(partial.verdict, "incorrect");
	assert.deepEqual(partial.missedCorrect.map((o) => o.label), ["3"]);
});

test("validation errors", () => {
	const store = createQuizStore(noShuffle);
	assert.throws(() => store.create({ ...planets, correctAnswer: "pluto" }), /does not match any option value/);
	assert.throws(() => store.create({ ...planets, explanation: " " }), /explanation is required/);
	assert.throws(() => store.create({ ...planets, options: [{ label: "Mercury" }] }), /at least two/);
	assert.throws(
		() => store.create({ ...planets, options: [...planets.options, { label: "Not sure" }] }),
		/opt-out choice/,
	);
	assert.throws(() => store.create({ ...planets, correctAnswer: ["mercury", "venus"] }), /multiSelect/);
	const { quizId } = store.create(planets);
	assert.throws(() => store.grade({ quizId, selected: "Z" }), /could not match/);
	assert.throws(() => store.grade({ quizId, selected: ["A", "B"] }), /exactly one/);
	store.grade({ quizId, selected: "A" });
	assert.throws(() => store.grade({ quizId, selected: "A" }), /already graded/);
	assert.throws(() => store.grade({ quizId: "nope", selected: "A" }), QuizError);
});

test("normalizeOptions trims, defaults value, rejects duplicates", () => {
	assert.deepEqual(normalizeOptions([{ label: " x " }, { label: "y", value: "Y" }, { label: "" }]), [
		{ label: "x", value: "x" },
		{ label: "y", value: "Y" },
	]);
	assert.throws(() => normalizeOptions([{ label: "a", value: "v" }, { label: "b", value: "v" }]), /duplicate/);
});

test("coerceCorrectAnswer handles arrays, JSON strings, and literals", () => {
	assert.deepEqual(coerceCorrectAnswer(["a"]), ["a"]);
	assert.deepEqual(coerceCorrectAnswer('["a","b"]'), ["a", "b"]);
	assert.deepEqual(coerceCorrectAnswer("[not json"), ["[not json"]);
});

test("lint flags answers that stand out by form", () => {
	const opts = [
		{ label: "It is faster", value: "a" },
		{ label: "It preserves ordering of messages because each packet carries a sequence number", value: "b" },
		{ label: "It is cheaper", value: "c" },
	];
	const w = lintOptions(opts, new Set(["b"]));
	assert.ok(w.some((m) => /longer/.test(m)));
	assert.ok(w.some((m) => /justification/.test(m)));
	const bold = lintOptions(
		[
			{ label: "uses **TCP**", value: "a" },
			{ label: "uses UDP", value: "b" },
		],
		new Set(["a"]),
	);
	assert.ok(bold.some((m) => /bold/.test(m)));
	assert.deepEqual(lintOptions(opts.slice(0, 1).concat(opts[2]), new Set(["a"])), []);
});

test("summary groups by concept and records misconceptions", () => {
	const store = createQuizStore(noShuffle);
	const a = store.create(planets);
	store.grade({ quizId: a.quizId, selected: "C" });
	const b = store.create(planets);
	store.grade({ quizId: b.quizId, selected: "A" });
	store.create({ ...planets, concept: "orbits", purpose: "probe" });
	const s = store.summary();
	assert.equal(s.totals.asked, 3);
	assert.equal(s.totals.pending, 1);
	const inner = s.concepts.find((c) => c.concept === "inner-planets");
	assert.equal(inner.correct, 1);
	assert.equal(inner.incorrect, 1);
	assert.deepEqual(inner.misconceptions, [{ quizId: "q1", chose: "Mars" }]);
	assert.equal(store.summary({ concept: "orbits" }).concepts.length, 1);
	assert.throws(() => store.create({ ...planets, purpose: "exam" }), /purpose/);
});
