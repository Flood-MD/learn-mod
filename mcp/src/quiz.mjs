// ────────────────────────────────────────────────────────────────────────────
// quiz core — harness-neutral grading logic, no MCP or UI dependencies.
//
// A quiz is split into two calls so it works in any agent harness:
//
//   1. create  — the agent supplies the question, options, correct answer and
//                explanation. We validate, shuffle, keep the answer key here,
//                and hand back ONLY what the learner may see.
//   2. grade   — the agent passes the learner's selection. We grade it against
//                the stored key and return the verdict, the correct answer, the
//                explanation, and which distractor (misconception) was chosen.
//
// Between the two calls the agent asks the learner with whatever question UI
// its harness has (DeepSeek Harness / Claude Code: ask_user_question; anything
// else: plain chat). Grading is deterministic and never depends on the model
// re-deriving the answer after the fact.
//
// State is in-memory and lives for one session (one server process).
// Persisting it across sessions is tracked in TODO.md.
// ────────────────────────────────────────────────────────────────────────────

export const DONT_KNOW_LABEL = "I don't know";

const PURPOSES = ["probe", "discovery", "check", "review"];

// Labels the agent must not supply itself: the "I don't know" choice is always
// added automatically and graded as a distinct outcome, not as a wrong answer.
const OPT_OUT_PATTERN = /^(i\s*do(n'?|\s*no)t\s*know|not\s*sure|i'?m\s*not\s*sure|unsure|no\s*idea|idk)[.!]?$/i;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export class QuizError extends Error {}

/**
 * Trim options, default `value` to the label, drop empty labels, and reject
 * duplicate values or agent-supplied opt-out options.
 */
export function normalizeOptions(options) {
	if (!Array.isArray(options)) throw new QuizError("options must be an array");
	const seen = new Set();
	const out = [];
	for (const raw of options) {
		const label = String(raw?.label ?? "").trim();
		if (label.length === 0) continue;
		const value = String(raw?.value ?? "").trim() || label;
		if (OPT_OUT_PATTERN.test(label)) {
			throw new QuizError(
				`option "${label}" is an opt-out choice; "${DONT_KNOW_LABEL}" is added automatically, so supply only real, gradable options`,
			);
		}
		if (seen.has(value)) throw new QuizError(`duplicate option value "${value}"`);
		seen.add(value);
		out.push({ label, value });
	}
	if (out.length < 2) throw new QuizError("a quiz needs at least two non-empty options");
	if (out.length > LETTERS.length) throw new QuizError(`a quiz supports at most ${LETTERS.length} options`);
	return out;
}

// Some harnesses deliver an array argument as a JSON-stringified string
// (e.g. '["a","b"]'). Parse that back; wrap a plain single value.
export function coerceCorrectAnswer(correctAnswer) {
	if (Array.isArray(correctAnswer)) return correctAnswer.map((v) => String(v).trim());
	if (correctAnswer === undefined || correctAnswer === null) return [];
	const trimmed = String(correctAnswer).trim();
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		try {
			const parsed = JSON.parse(trimmed);
			if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim());
		} catch {
			// Not JSON — treat as one literal value.
		}
	}
	return [trimmed];
}

/** Fisher-Yates over a copy. `random` is injectable for tests. */
export function shuffle(items, random = Math.random) {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * Cheap checks for answer leaks by form. These encode the "options must not
 * give the answer away" rules from the teach skill as warnings the agent can
 * act on before showing the question. They never block the quiz.
 */
export function lintOptions(options, correctValues) {
	const warnings = [];
	const correct = options.filter((o) => correctValues.has(o.value));
	const wrong = options.filter((o) => !correctValues.has(o.value));
	if (wrong.length === 0) return warnings;

	const avg = (xs) => xs.reduce((s, o) => s + o.label.length, 0) / xs.length;
	const correctLen = avg(correct);
	const wrongLen = avg(wrong);
	if (correctLen > wrongLen * 1.5 && correctLen - wrongLen > 15) {
		warnings.push(
			"The correct option is much longer than the distractors; a learner can pick it by length alone. Rewrite so all options have similar length and specificity.",
		);
	}
	const bolded = (o) => /\*\*[^*]+\*\*/.test(o.label);
	if (correct.some(bolded) && !wrong.some(bolded)) {
		warnings.push("Only the correct option contains bold text. Bold the parallel term in every option, or in none.");
	}
	const justifies = (o) => /\b(because|since|so that|which means)\b/i.test(o.label);
	if (correct.some(justifies) && !wrong.some(justifies)) {
		warnings.push(
			"Only the correct option carries a justification (\"because…\"). Options should be bare claims; put reasoning in the explanation.",
		);
	}
	return warnings;
}

function sameSet(a, b) {
	if (a.length !== b.length) return false;
	const s = new Set(a);
	return b.every((x) => s.has(x));
}

export function createQuizStore({ random = Math.random, now = () => new Date() } = {}) {
	const quizzes = new Map();
	let counter = 0;

	function create(params) {
		const question = String(params?.question ?? "").trim();
		if (!question) throw new QuizError("question is required");
		const explanation = String(params?.explanation ?? "").trim();
		if (!explanation) throw new QuizError("explanation is required — say why the correct answer is correct");

		const purpose = params.purpose ?? "check";
		if (!PURPOSES.includes(purpose)) throw new QuizError(`purpose must be one of: ${PURPOSES.join(", ")}`);

		let options = normalizeOptions(params.options);
		const multiSelect = Boolean(params.multiSelect);

		const correctValues = coerceCorrectAnswer(params.correctAnswer).filter((v) => v.length > 0);
		if (correctValues.length === 0) throw new QuizError("correctAnswer is required (the option value, not a position)");
		const known = new Set(options.map((o) => o.value));
		for (const v of correctValues) {
			if (!known.has(v)) {
				const list = options.map((o) => `"${o.value}"`).join(", ");
				throw new QuizError(`correctAnswer "${v}" does not match any option value (${list})`);
			}
		}
		const correctSet = new Set(correctValues);
		if (!multiSelect && correctSet.size > 1) {
			throw new QuizError("several correct answers were given; set multiSelect: true for a multi-select question");
		}
		if (correctSet.size === options.length) {
			throw new QuizError("every option is marked correct; add at least one real distractor");
		}

		const warnings = lintOptions(options, correctSet);

		// Shuffle BEFORE assigning letters so grading matches what the learner sees.
		if (params.shuffle !== false) options = shuffle(options, random);
		const displayed = options.map((o, i) => ({ key: LETTERS[i], label: o.label, value: o.value }));

		const id = `q${++counter}`;
		const quiz = {
			id,
			question,
			details: params.details ? String(params.details).trim() : undefined,
			concept: params.concept ? String(params.concept).trim() : undefined,
			purpose,
			multiSelect,
			options: displayed,
			correctValues: correctSet,
			explanation,
			createdAt: now().toISOString(),
			result: undefined,
		};
		quizzes.set(id, quiz);

		return {
			quizId: id,
			question,
			details: quiz.details,
			multiSelect,
			options: displayed.map((o) => ({ key: o.key, label: o.label })),
			dontKnowOption: DONT_KNOW_LABEL,
			warnings,
		};
	}

	// Accepts a letter ("B", "b.", "B) …"), the exact label, or the
	// "I don't know" label. Case- and surrounding-whitespace-insensitive.
	function resolveSelection(quiz, raw) {
		const s = String(raw ?? "").trim();
		if (!s) return undefined;
		if (OPT_OUT_PATTERN.test(s) || s.toLowerCase() === DONT_KNOW_LABEL.toLowerCase()) return "dont_know";
		const lower = s.toLowerCase();
		const byLabel = quiz.options.find((o) => o.label.toLowerCase() === lower);
		if (byLabel) return byLabel;
		const letter = /^([a-z])(?:[.):\s]|$)/i.exec(s);
		if (letter) {
			const byKey = quiz.options.find((o) => o.key === letter[1].toUpperCase());
			if (byKey) return byKey;
		}
		const byKeyedLabel = quiz.options.find((o) => lower === `${o.key}. ${o.label}`.toLowerCase());
		return byKeyedLabel;
	}

	function grade(params) {
		const quiz = quizzes.get(String(params?.quizId ?? ""));
		if (!quiz) throw new QuizError(`unknown quizId "${params?.quizId}" — call quiz_create first`);
		if (quiz.result) throw new QuizError(`quiz ${quiz.id} was already graded`);

		const rawSelected = Array.isArray(params.selected) ? params.selected : coerceCorrectAnswer(params.selected);
		if (rawSelected.length === 0) throw new QuizError("selected is required (letter or label of the learner's choice)");

		const resolved = rawSelected.map((r) => ({ raw: r, hit: resolveSelection(quiz, r) }));
		const unknown = resolved.filter((r) => !r.hit);
		if (unknown.length > 0) {
			const valid = [...quiz.options.map((o) => `${o.key}. ${o.label}`), DONT_KNOW_LABEL].join(" | ");
			throw new QuizError(`could not match ${unknown.map((u) => `"${u.raw}"`).join(", ")} to an option. Valid: ${valid}`);
		}

		const dontKnow = resolved.some((r) => r.hit === "dont_know");
		const picked = dontKnow ? [] : [...new Map(resolved.map((r) => [r.hit.value, r.hit])).values()];
		if (!dontKnow && !quiz.multiSelect && picked.length > 1) {
			throw new QuizError("single-select question: pass exactly one selection");
		}

		const correctOptions = quiz.options.filter((o) => quiz.correctValues.has(o.value));
		const isCorrect =
			!dontKnow &&
			sameSet(
				picked.map((o) => o.value),
				correctOptions.map((o) => o.value),
			);
		const verdict = dontKnow ? "dont_know" : isCorrect ? "correct" : "incorrect";
		const distractorsChosen = picked.filter((o) => !quiz.correctValues.has(o.value));
		const missed = isCorrect || dontKnow ? [] : correctOptions.filter((o) => !picked.some((p) => p.value === o.value));
		const note = params.note ? String(params.note).trim() || undefined : undefined;

		quiz.result = {
			verdict,
			selected: picked.map((o) => o.value),
			distractorsChosen: distractorsChosen.map((o) => o.value),
			note,
			gradedAt: now().toISOString(),
		};

		return {
			quizId: quiz.id,
			concept: quiz.concept,
			verdict,
			selected: picked.map(({ key, label, value }) => ({ key, label, value })),
			correct: correctOptions.map(({ key, label, value }) => ({ key, label, value })),
			distractorsChosen: distractorsChosen.map(({ key, label, value }) => ({ key, label, value })),
			missedCorrect: missed.map(({ key, label, value }) => ({ key, label, value })),
			note,
			explanation: quiz.explanation,
			feedback: renderFeedback(quiz, picked, dontKnow, verdict),
		};
	}

	function summary(params = {}) {
		const filter = params.concept ? String(params.concept).trim() : undefined;
		const byConcept = new Map();
		for (const quiz of quizzes.values()) {
			const concept = quiz.concept ?? "(untagged)";
			if (filter && concept !== filter) continue;
			let row = byConcept.get(concept);
			if (!row) {
				row = { concept, asked: 0, correct: 0, incorrect: 0, dontKnow: 0, pending: 0, misconceptions: [], history: [] };
				byConcept.set(concept, row);
			}
			row.asked++;
			const v = quiz.result?.verdict;
			if (!v) row.pending++;
			else if (v === "correct") row.correct++;
			else if (v === "incorrect") row.incorrect++;
			else row.dontKnow++;
			if (quiz.result) {
				for (const value of quiz.result.distractorsChosen) {
					const opt = quiz.options.find((o) => o.value === value);
					row.misconceptions.push({ quizId: quiz.id, chose: opt?.label ?? value });
				}
			}
			row.history.push({
				quizId: quiz.id,
				purpose: quiz.purpose,
				question: quiz.question,
				verdict: v ?? "pending",
				...(quiz.result?.note ? { note: quiz.result.note } : {}),
			});
		}
		const concepts = [...byConcept.values()];
		const totals = concepts.reduce(
			(t, r) => ({
				asked: t.asked + r.asked,
				correct: t.correct + r.correct,
				incorrect: t.incorrect + r.incorrect,
				dontKnow: t.dontKnow + r.dontKnow,
				pending: t.pending + r.pending,
			}),
			{ asked: 0, correct: 0, incorrect: 0, dontKnow: 0, pending: 0 },
		);
		return { scope: "this session only (not persisted)", totals, concepts };
	}

	return { create, grade, summary, _quizzes: quizzes };
}

// Markdown the agent can show verbatim after grading: the full option list in
// display order with ✓/✗ marks, the verdict, the learner's note, and the
// explanation.
function renderFeedback(quiz, picked, dontKnow, verdict) {
	const pickedValues = new Set(picked.map((o) => o.value));
	const lines = [];
	for (const o of quiz.options) {
		const isKey = quiz.correctValues.has(o.value);
		const isPicked = pickedValues.has(o.value);
		let mark = " ";
		if (isKey) mark = "✓";
		else if (isPicked) mark = "✗";
		const suffix = isPicked ? " ← your answer" : "";
		lines.push(`${mark} ${o.key}. ${o.label}${suffix}`);
	}
	if (dontKnow) lines.push(`   (you chose "${DONT_KNOW_LABEL}")`);
	lines.push("");
	lines.push(verdict === "correct" ? "**Correct.**" : verdict === "incorrect" ? "**Incorrect.**" : `**${DONT_KNOW_LABEL}** — that's useful to know.`);
	lines.push("");
	lines.push(quiz.explanation);
	return lines.join("\n");
}
