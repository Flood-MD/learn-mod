// End-to-end: talk to the real server over stdio, the way a harness does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = fileURLToPath(new URL("../src/server.mjs", import.meta.url));

function parse(result) {
	const text = result.content[0].text;
	return JSON.parse(text.slice(text.indexOf("{")));
}

test("quiz round trip over MCP stdio", async () => {
	const client = new Client({ name: "test", version: "0.0.0" });
	await client.connect(new StdioClientTransport({ command: process.execPath, args: [serverPath] }));
	try {
		const { tools } = await client.listTools();
		assert.deepEqual(tools.map((t) => t.name).sort(), ["quiz_create", "quiz_grade", "quiz_summary"]);
		assert.match(client.getInstructions() ?? "", /quiz_create/);

		const created = parse(
			await client.callTool({
				name: "quiz_create",
				arguments: {
					question: "2 + 2 = ?",
					options: [{ label: "3" }, { label: "4" }, { label: "5" }],
					correctAnswer: "4",
					explanation: "Two pairs make four.",
					concept: "addition",
				},
			}),
		);
		assert.equal(created.options.length, 3);
		const four = created.options.find((o) => o.label === "4");

		const graded = parse(
			await client.callTool({ name: "quiz_grade", arguments: { quizId: created.quizId, selected: four.key } }),
		);
		assert.equal(graded.verdict, "correct");

		const bad = await client.callTool({ name: "quiz_grade", arguments: { quizId: "q999", selected: "A" } });
		assert.equal(bad.isError, true);
		assert.match(bad.content[0].text, /unknown quizId/);

		const summary = parse(await client.callTool({ name: "quiz_summary", arguments: {} }));
		assert.equal(summary.totals.correct, 1);
	} finally {
		await client.close();
	}
});
