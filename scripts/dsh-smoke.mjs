#!/usr/bin/env node
// Smoke test: DeepSeek Harness + this workspace, with no API key and no model
// cost. It starts a scripted mock model (an OpenAI-compatible endpoint), runs one
// headless dsh session against it, and checks that the session:
//   • offered the model the learn MCP tools and the `teach` skill,
//   • included AGENTS.md in the model's context,
//   • executed quiz_create → quiz_grade through dsh's MCP bridge.
//
//   node scripts/dsh-smoke.mjs
//
// Uses a throwaway DSH_HOME, so your real dsh settings are untouched.

import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";

// Make sure the learn patch exists and the server has its dependencies.
if (spawnSync(process.execPath, [join(ROOT, "scripts", "learn.mjs"), "setup", "dsh"], { stdio: "inherit" }).status !== 0) {
	process.exit(1);
}

const seen = { requests: 0, tools: [], context: "", toolResults: [] };

// One scripted turn per request: create a quiz, grade it, then finish.
function script(body) {
	seen.requests++;
	const tools = (body.tools ?? []).map((t) => t.function?.name ?? t.name);
	if (seen.requests === 1) {
		seen.tools = tools;
		seen.context = JSON.stringify(body.messages ?? []);
	}
	const toolMsgs = (body.messages ?? []).filter((m) => m.role === "tool");
	const lastTool = toolMsgs.at(-1);
	if (lastTool) seen.toolResults.push(typeof lastTool.content === "string" ? lastTool.content : JSON.stringify(lastTool.content));
	const create = tools.find((n) => /quiz_create$/.test(n));
	const grade = tools.find((n) => /quiz_grade$/.test(n));

	if (toolMsgs.length === 0 && create) {
		return toolCall(create, {
			question: "2 + 2 = ?",
			options: [{ label: "3" }, { label: "4" }, { label: "5" }],
			correctAnswer: "4",
			explanation: "Two pairs make four.",
			concept: "addition",
			purpose: "check",
		});
	}
	if (toolMsgs.length === 1 && grade) {
		const text = seen.toolResults.at(-1) ?? "";
		const quizId = /"quizId":\s*"([^"]+)"/.exec(text)?.[1] ?? "q1";
		const key = /"key":\s*"([A-Z])",\s*"label":\s*"4"/.exec(text)?.[1] ?? "A";
		return toolCall(grade, { quizId, selected: key });
	}
	return { content: "SMOKE-DONE" };
}

function toolCall(name, args) {
	return { toolCall: { name, arguments: JSON.stringify(args) } };
}

function sse(res, reply) {
	res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
	const base = { id: `mock-${seen.requests}`, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: "mock-model" };
	const send = (obj) => res.write(`data: ${JSON.stringify({ ...base, ...obj })}\n\n`);
	if (reply.toolCall) {
		send({
			choices: [
				{
					index: 0,
					delta: {
						role: "assistant",
						tool_calls: [{ index: 0, id: `call_${seen.requests}`, type: "function", function: reply.toolCall }],
					},
					finish_reason: null,
				},
			],
		});
		send({ choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] });
	} else {
		send({ choices: [{ index: 0, delta: { role: "assistant", content: reply.content }, finish_reason: null }] });
		send({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
	}
	send({ choices: [], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
	res.write("data: [DONE]\n\n");
	res.end();
}

const server = createServer((req, res) => {
	let raw = "";
	req.on("data", (c) => (raw += c));
	req.on("end", () => {
		if (req.method === "GET" && req.url.endsWith("/models")) {
			res.writeHead(200, { "content-type": "application/json" });
			return res.end(JSON.stringify({ data: [{ id: "mock-model" }] }));
		}
		let body = {};
		try {
			body = JSON.parse(raw || "{}");
		} catch {}
		sse(res, script(body));
	});
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const home = mkdtempSync(join(tmpdir(), "dsh-smoke-"));
const mockPatch = join(home, "mock-model.cordis.yml");
writeFileSync(
	mockPatch,
	`- id: llm-pi-ai
  config:
    providers:
      mock:
        api: openai-completions
        baseURL: http://127.0.0.1:${port}/v1
        apiKeyEnv: DSH_SMOKE_MOCK_KEY
        compat:
          supportsDeveloperRole: false
          maxTokensField: max_tokens
        models:
          - id: mock-model
- id: agent-default-model
  config:
    provider: mock
    model: mock-model
`,
);

const args = [
	"-y",
	"@deepseek-ai/dsh@latest",
	"--profile",
	"headless",
	"--patch",
	join(ROOT, "harness", "dsh", "learn.cordis.yml"),
	"--patch",
	mockPatch,
	"--json",
	"Smoke test: run one quiz.",
];
console.log("Running headless dsh against the mock model…");
const child = spawn("npx", isWindows ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args, {
	cwd: ROOT,
	shell: isWindows,
	env: { ...process.env, DSH_HOME: home, DSH_SMOKE_MOCK_KEY: "mock" },
});
let out = "";
let err = "";
child.stdout.on("data", (d) => (out += d));
child.stderr.on("data", (d) => (err += d));
const timer = setTimeout(() => child.kill(), 240_000);
const code = await new Promise((r) => child.on("close", r));
clearTimeout(timer);
server.close();

const checks = [
	["dsh exited cleanly", code === 0],
	["learn MCP tools offered to the model", seen.tools.some((n) => /quiz_create$/.test(n)) && seen.tools.some((n) => /quiz_grade$/.test(n))],
	["teach skill in the skill catalog", seen.context.includes("so it is understood, not just memorized")],
	["AGENTS.md included in context", seen.context.includes("Learning workspace")],
	["quiz_create ran through dsh", seen.toolResults.some((t) => t.includes('"quizId"') && t.includes('"options"'))],
	["quiz_grade returned a correct verdict", seen.toolResults.some((t) => t.includes('"verdict": "correct"'))],
	["session finished", out.includes("SMOKE-DONE")],
];
let failed = 0;
for (const [name, pass] of checks) {
	console.log(`${pass ? "✓" : "✗"} ${name}`);
	if (!pass) failed++;
}
if (failed) {
	console.log(`\nModel requests: ${seen.requests}. Tools offered: ${seen.tools.join(", ") || "(none)"}`);
	console.log(`dsh exit code: ${code}\n--- dsh stderr (tail) ---\n${err.slice(-3000)}\n--- dsh stdout (tail) ---\n${out.slice(-3000)}`);
}
rmSync(home, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
