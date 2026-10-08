# TODO

The current system runs **single, self-contained sessions**. Within one session the tutor probes the learner's level, agrees a goal, plans a dependency map and teaches it with graded quizzes. When the session ends, all of that is gone, apart from the recap the tutor prints for the learner to paste into the next session.

The items below turn this into an ongoing, multi-session teaching system. Items 1–3 share a storage layer, so build them together. Keep everything harness-neutral: new capabilities go in the `learn` MCP server (`mcp/`) and the skills (`.agents/skills/`), not in harness-specific plugins.

## 1. Persist knowledge graphs

- [ ] Store each topic's dependency map as data rather than only as a Mermaid block in chat. Each node needs:
  - an id;
  - a statement;
  - a kind: unconditional truth or derived;
  - its dependencies;
  - its source references.
- [ ] Add MCP tools to create, update and read the graph, for example `graph_upsert_node`, `graph_link`, `graph_get`, and `graph_frontier`, which returns nodes whose prerequisites are mastered.
- [ ] The `concept` ids that quizzes already carry become the node ids, so quiz evidence attaches to nodes with no migration.
- [ ] Render the stored graph back to Mermaid, coloured by learner status.
- [ ] Decide the storage format. Plain files (one JSON/Markdown file per node, or one file per topic) keep it inspectable and Obsidian-friendly; see item 6.

## 2. Persist learner state and progress

- [ ] Write each `quiz_grade` result to an append-only evidence log covering:
  - timestamp, concept, purpose, verdict;
  - the distractor chosen, and the learner's note.
- [ ] Derive a status per node from that evidence: unknown, held (shown in probing), misconception, learning, or mastered. Start with simple rules; consider BKT, Elo or FSRS later.
- [ ] Snapshot the probe results as the learner's **starting state** for a topic. Current statuses are their **present state**.
- [ ] Load the relevant state at session start so the tutor resumes instead of re-probing from zero. It should still spot-check a few stored "mastered" nodes, because knowledge decays.
- [ ] Add spaced review: schedule reviews of mastered nodes and offer a warm-up of due items at session start, putting prerequisites of today's material first.
- [ ] Extend `quiz_summary` across sessions, with history and trends per node.

## 3. Persist user goal

- [ ] Store the goal the learner agreed in Phase 1b: their wording, the clarified concrete version, and the goal node(s) in the graph.
- [ ] Track progress toward it: the share of the goal's prerequisite subgraph that is mastered, and the next frontier nodes on the path to it.
- [ ] Support several goals per learner, and revising a goal with its history kept, not overwritten.
- [ ] Show starting state, present state and goal together at the start and end of every session.

## 4. Knowledge management of provided sources

- [ ] Let the learner supply their own material (PDFs, notes, web pages, textbook chapters, lecture transcripts) as the basis for a topic.
- [ ] Ingest it into a source store with stable citations (document, page or section, quoted span).
- [ ] Ground graph nodes, explanations and quiz explanations in cited passages. The researcher step checks against the provided sources first, then the web.
- [ ] Extract candidate nodes and dependencies from sources to seed the knowledge graph, with the tutor confirming them rather than accepting them blindly.
- [ ] Flag conflicts between sources, and between a source and the tutor's own claims.
- [ ] Decide on retrieval: plain-text search may be enough at personal scale; add embeddings only if needed.

## 5. Expand to written and other tests beyond multiple choice

Multiple choice tests *recognising* an answer. Understanding also needs *recall* and *production*.

- [ ] **Free recall / short answer:** the learner types an answer, which is graded against a rubric fixed in `quiz_create` *before* asking (key points that must appear, and known misconceptions). The model applies the rubric, and the server records it.
- [ ] **Numeric answers** with a tolerance and units, graded deterministically by the server.
- [ ] **Derivations and explanations:** grade step by step against the dependency map ("explain why X follows from Y").
- [ ] **Ordering / matching / fill-in-the-blank** for sequences and definitions, graded deterministically.
- [ ] **Confidence rating** before reveal ("how sure are you?"), to surface confident misconceptions.
- [ ] **Recall first, then choose:** ask free recall first, then show multiple-choice options.
- [ ] **Code exercises** where the harness can run code: small tasks checked by tests.
- [ ] Record every test type through the same evidence log (item 2), so mastery estimates use all of them.

## 6. Integrate with Obsidian as an ongoing interaction

- [ ] Make an Obsidian vault the learner's persistent, human-readable home for items 1–4:
  - one note per graph node with `[[links]]` for dependencies, so Obsidian's graph view shows the knowledge graph;
  - frontmatter for status and evidence;
  - one note per goal and per session.
- [ ] Mirror each session into a Markdown lesson log as it happens. Write quiz questions as they are asked and append answers and feedback after grading, never leaking the answer early. This replaces the old pi `md-log` extension in a harness-neutral way; MCP alone can't see lesson prose, so this needs a per-harness hook or the tutor writing the log itself.
- [ ] Render math (LaTeX) and diagrams (Mermaid, or PNG/SVG embeds) natively in the vault.
- [ ] Two-way interaction: the learner edits or annotates notes (corrects a node, adds a question, marks something confusing) and the next session picks those edits up.
- [ ] Optional: let the learner start review sessions from Obsidian, for example from a "due today" note.

---

### Removed in the refactor; may come back as part of the items above

- **Rendered, self-checked diagrams.** The pi version used subagents that rendered Mermaid/SVG to PNG and looked at the image before publishing it. Diagrams are now inline Mermaid/SVG checked from the source. Rendering could return under item 6.
- **A native quiz card in DeepSeek Harness.** A dsh plugin could run create → ask → grade in a single tool call using `ctx.userQuestions`, and keep the answer key out of the visible tool-call arguments. The MCP flow was chosen first because it works in every harness.
