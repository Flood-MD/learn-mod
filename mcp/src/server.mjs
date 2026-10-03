#!/usr/bin/env node
// learn-mcp — stdio MCP server exposing graded quizzes to any agent harness
// (DeepSeek Harness, Claude Code, OpenAI Codex, …). Tools appear to the model
// as mcp__learn__quiz_create / quiz_grade / quiz_summary.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createQuizStore, DONT_KNOW_LABEL, QuizError } from "./quiz.mjs";

const INSTRUCTIONS = `Graded quizzes for teaching. One quiz takes three steps:
1. quiz_create with the question, options, correctAnswer (an option value) and explanation. The result lists the options in shuffled display order with letters, and never includes the answer.
2. Ask the learner with your harness's question tool (e.g. ask_user_question) or in plain chat. Show the options in the returned order, labelled with their letters, and add "${DONT_KNOW_LABEL}" as the last choice. Never reveal or hint at the answer before grading.
3. quiz_grade with the learner's choice (letter or label) and any note they typed. Show the returned feedback, then use verdict and distractorsChosen to decide what to teach next.
quiz_summary reports this session's results per concept. Nothing is saved after the session ends.`;

const store = createQuizStore();

const server = new McpServer({ name: "learn", version: "0.1.0" }, { instructions: INSTRUCTIONS });

function ok(payload, lead) {
	const text = (lead ? `${lead}\n\n` : "") + JSON.stringify(payload, null, 2);
	return { content: [{ type: "text", text }] };
}

function fail(err) {
	if (err instanceof QuizError) return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
	throw err;
}

server.registerTool(
	"quiz_create",
	{
		title: "Create a graded quiz question",
		description:
			"Register ONE multiple-choice question that has a correct answer. Returns the learner-facing question with options shuffled and lettered (A, B, C…), and no answer. Then ask the learner and call quiz_grade. " +
			"Write each wrong option as a specific misconception the learner might hold, so the option they pick shows exactly what they misunderstand. Keep all options as bare claims of similar length and form, with no reasoning in them; reasoning goes in explanation. " +
			`Do not add an opt-out option such as "${DONT_KNOW_LABEL}"; one is always offered. Act on any warnings by rewriting the options before asking.`,
		inputSchema: {
			question: z.string().describe("The single question to ask."),
			details: z.string().optional().describe("Optional context shown under the question."),
			options: z
				.array(
					z.object({
						label: z.string().describe("Text the learner sees."),
						value: z.string().optional().describe("Stable id for this option; defaults to the label. correctAnswer refers to it."),
					}),
				)
				.min(2)
				.describe("The real, gradable options (2 or more)."),
			correctAnswer: z
				.union([z.string(), z.array(z.string())])
				.describe("The value of the correct option; for multiSelect, an array of values. Never a position number."),
			explanation: z.string().describe("Why the correct answer is correct, ideally addressing the tempting distractors. Revealed only after grading."),
			multiSelect: z.boolean().optional().describe("True when more than one option is correct and the learner must pick exactly that set."),
			shuffle: z.boolean().optional().describe("Default true. Set false only when option order carries meaning, e.g. ordered numbers."),
			concept: z
				.string()
				.optional()
				.describe("Short id of the node in the lesson's dependency map this question tests, e.g. 'packets-are-atomic'. Used to group results."),
			purpose: z
				.enum(["probe", "discovery", "check", "review"])
				.optional()
				.describe("probe = mapping the learner's current level; discovery = a Socratic step; check = confirming a node landed (default); review = revisiting earlier material."),
		},
	},
	async (args) => {
		try {
			const res = store.create(args);
			const lead = res.warnings.length
				? "Created, but there are warnings. Consider rewriting the options with quiz_create before asking."
				: "Created. Ask the learner now and don't reveal the answer.";
			return ok(res, lead);
		} catch (err) {
			return fail(err);
		}
	},
);

server.registerTool(
	"quiz_grade",
	{
		title: "Grade the learner's answer",
		description:
			"Grade the learner's answer to a quiz from quiz_create. Pass their choice as a letter or the option label, or \"I don't know\". Returns the verdict (correct / incorrect / dont_know), the correct option(s), any distractors they chose, and ready-to-show feedback. " +
			"Treat dont_know as a real gap to teach into, not a wrong guess. A chosen distractor names the specific misconception to address.",
		inputSchema: {
			quizId: z.string().describe("The quizId returned by quiz_create."),
			selected: z
				.union([z.string(), z.array(z.string())])
				.describe("The learner's choice(s): a letter like 'B', the option label, or \"I don't know\"."),
			note: z.string().optional().describe("Any free text the learner added (what they were thinking or unsure about)."),
		},
	},
	async (args) => {
		try {
			return ok(store.grade(args), "Show `feedback` to the learner, then decide the next step from the verdict.");
		} catch (err) {
			return fail(err);
		}
	},
);

server.registerTool(
	"quiz_summary",
	{
		title: "Summarize this session's quiz results",
		description:
			"Per-concept tally of this session's quizzes (correct / incorrect / don't know / pending), with the misconceptions chosen and a short history. Use it before planning, before moving to a new node, and at the end of a session. In-memory only; it resets when the session ends.",
		inputSchema: {
			concept: z.string().optional().describe("Limit the summary to one concept id."),
		},
	},
	async (args) => {
		try {
			return ok(store.summary(args));
		} catch (err) {
			return fail(err);
		}
	},
);

await server.connect(new StdioServerTransport());
