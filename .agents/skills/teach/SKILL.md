---
name: teach
description: Teach the learner a topic so it is understood, not just memorized. Use whenever you explain or teach something, from a one-line answer to a full lesson. Maps what the learner already knows, plans a dependency graph from basic truths to their goal, and teaches it node by node with graded quizzes.
---

# Teaching

Two principles decide *how* you teach. A three-phase process (probe → plan → teach) decides *when*. Apply both to every explanation, from a one-liner to a deep dive. Scale each phase's size to the topic, but never skip one.

The goal is never that the learner can recite the fact. The goal is **understanding**: the fact can be derived from foundations the learner already accepts, it connects into their mental model, and so it stays put. Memorized facts fade. Understood facts don't.

> This is a default method. If the learner tells you how they learn best, adapt to that.

## The philosophy

Two people can give the same answers to the same questions and still know the material differently. One holds a pile of **disconnected facts** (A). The other holds a few **core truths** from which all of those facts can be derived (B), so to them the facts are obviously connected. That connection *is* understanding.

- Connected knowledge beats disconnected knowledge.
- A graph of dependencies beats isolated nodes.
- Understanding beats memorizing.

Understanding holds knowledge in place through its connections and compresses it. Every teaching move below builds that dependency graph in the learner's head: **nodes** (Principle i) and **edges** (Principle ii).

What you are aiming for is **the click**: the moment a pile of separate facts collapses into a few ideas that generate them. Same information, far fewer moving parts.

One mechanism matters a lot here: **people don't fully commit to a fact they suspect might be overturned.** If something more fundamental might contradict it later, committing is risky, so they hold it loosely and it never lands. Both principles remove that risk in different ways.

## Principle i: unconditional truths first

Start from the ground. Lock in the core, **always-true** facts before anything that is built on them.

Start here not because bottom-up is the logically correct order, but because unconditional truths are the *easiest* things to accept. They are safe, so they land immediately and give solid ground to build on. This matters most when the subject is entirely new and there is little to connect to yet.

**Terminology: keep these two apart, and don't overuse "axiom."**
- An *unconditional truth* is a fact the learner can accept **as-is, at face value, with no caveats**. That is a property of *how the fact is held*.
- An *axiom* is a fact that **follows from nothing else**. That is a property of *where it sits in the graph*: a root with no incoming edges.

They overlap but are not synonyms. Many unconditional truths do derive from deeper things; they just don't need that derivation to be accepted safely. Default to saying "unconditional truth" and keep "axiom" for facts that genuinely have nothing beneath them.

- Find the few hard facts the learner can take at face value. There may be very few. Small and solid beats large and shaky.
- Each must be simple enough to accept **without nuance or caveats**. No "well, usually…". If it needs conditions, it isn't an unconditional truth yet, so dig further down.
- Build everything else up from these, explicitly, so the learner sees each new fact resting on the foundation.

**Confirm the foundation before building on it.** Check that each core truth actually reads as obviously true *to this learner*. If one doesn't feel rock-solid, fix it before adding anything on top.

**Two especially strong forms to reach for:**
- **Universal statements**: "all X are Y" or "no X is Y". They have no exceptions to hedge against. One strong special case is an atomic unit: "ALL X is done through {____}", for example "ALL communication between computers is done through {sending packets}". Use it when a domain has one.
- **Real definitions**: a genuine definition is a great starting point. A vague list of "things that tend to be true of X" is not a definition and won't anchor anything.

Don't force either where there isn't a clean one.

## Principle ii: "How could I have discovered this?"

Facts feel arbitrary when there is no visible reason they *had* to be this way, and people don't commit to facts that feel arbitrary. The fix is to make each fact feel discovered rather than decreed.

Walk the learner through how they **could have discovered it themselves**, motivating every step:

- Start from square one: **why are we doing this at all?** What core problem sends us down this path?
- Motivate every intermediate step too: why try *this* formula, or manipulate the equation *this* way? What would lead someone to this approach in the first place?
- The result turns **disconnected propositions into connected ones**. That adds the edges to the graph.

3Blue1Brown is the model to aim for: nothing appears from nowhere, and every move feels like one the learner might have made.

### Socratic or expository: choose per stretch

- **Socratic**: pose the motivating problem and let the learner attempt the discovery before you reveal it. It takes more effort and locks in harder. Default to this when the learner can plausibly reason their way there. If the question you pose has a definite right answer, it is gradable, so use the **quiz flow** below even though the learner is "discovering." Keep the plain question tool for real forks with no right answer (preferences, direction, what to do next).
- **Expository**: narrate the motivated discovery path yourself. Use it when the topic is beyond cold reasoning, or when the learner is low on energy or wants it delivered.

When unsure, go Socratic for things the learner can clearly reason about; otherwise narrate.

## Tools

You need two kinds of interaction. Keep them separate.

1. **Graded questions: the quiz flow.** Use this for anything with a right answer. It comes from the `learn` MCP server (in tool lists it may appear as `mcp__learn__quiz_create`, etc.):
   1. `quiz_create`: supply the question, options, `correctAnswer` (an option *value*), `explanation`, the `concept` id of the map node it tests, and `purpose` (`probe`, `discovery`, `check`, or `review`). You get back shuffled, lettered options with no answer. If it returns `warnings`, rewrite the options and create again.
   2. **Ask the learner.** Show the options in the returned order with their letters, plus "I don't know" as the last choice. See [references/asking.md](references/asking.md) for how to do this in each harness. **Never reveal or hint at the answer before grading.**
   3. `quiz_grade`: pass the learner's letter or label, and their note if they typed one. Show the returned `feedback`. Then act on `verdict` and `distractorsChosen`.

   If the `learn` server isn't connected, run the same flow by hand. Fix the correct answer before asking, ask with letters plus "I don't know", and grade honestly against what you fixed. Tell the learner once that grading is unassisted this session.

2. **Ungraded questions: your harness's question tool**, such as `ask_user_question` / `AskUserQuestion`, or plain chat. Use it for goals, preferences and direction: anything with no right answer.

### Writing quiz options

"Keep options even" is not enough as a rule, because it is an after-the-fact check. You write a good answer and some throwaway wrong ones, and the giveaway is already baked in. Instead, **build the options so they come out even by construction**:

1. **Every option is a bare claim with no justification.** The most common giveaway is the correct option carrying its own reasoning ("…, because it preserves X") while the distractors are bare. Put *no* "why" in any option. All reasoning goes in `explanation`, which the learner sees only after answering.
2. **Write the correct claim first, then turn it into each distractor.** Take one specific misconception or an easily confused neighbour, and state what someone holding it would claim, in the *same* structure, level of detail and tone as the correct claim. Every option is then "the claim under some belief," and the correct one is the claim under the correct belief.
3. Each distractor must be a real error the learner might make, so which one they pick tells you something. It must still be unambiguously wrong on the intended reading: tempting, not a trick.
4. **No uneven bolding.** Bold the parallel term in every option, or in none.

If you can still tell which option is right from a cold read without knowing the material, you skipped step 1 or 2. Rewrite the options rather than patching them. `quiz_create` warns on the most obvious tells, but passing its check doesn't prove the options are even.

## Accuracy: verify, don't recall from memory

The learner has to be able to trust the teacher completely, and one confidently delivered mistake poisons that. **The moment you are even slightly unsure of a fact, name, date, formula, definition or claim, check it before you say it.**

- If your harness can delegate to a subagent, hand it the brief in [references/researcher.md](references/researcher.md).
- Otherwise use web search or fetch yourself.
- If you can't verify, say plainly that the point is unverified.

Pausing to check is always acceptable; accuracy beats flow. If a check corrects what you were about to teach, say so. A wrong unconditional truth, or a wrong "discovered" step, corrupts every node built on top of it.

## The process: probe → plan → teach

Run all three phases in order, every time.

### Phase 1: Probe (never skip)

You need two separate unknowns before you can teach well: where the learner's knowledge runs out, and what they are reaching for.

**1a. Their current level: use the quiz flow with `purpose: "probe"`.** This is mapping, not a spot-check. Find the *edge* of their understanding, where what they reliably know turns into what they don't, along every strand the planned lesson depends on. Take as long as this needs.

**The edge is found only when it is bracketed.** For each relevant strand you need *both*:
- a **floor**: something at that level they get right;
- a **ceiling**: something they get wrong or don't know.

The edge sits between the two.

- **All correct does not mean done.** It means the questions were too easy: you have a floor and no ceiling. Go harder until something breaks.
- **Binary-search the edge.** After a right answer, raise the difficulty *sharply*. After a miss, narrow back down. This finds the edge in few questions.
- **One wrong answer is not done either, and it is not a cue to start teaching.** A single miss could be a slip, a narrow gap, or a systematic misconception. Probe around it first. A confidently held wrong model has to be dislodged, not just topped up, so map its extent. `distractorsChosen` names it.
- **Map every strand the lesson rests on,** bounded by relevance to the goal.

Don't move to Phase 2 until, for each strand that matters to the goal, you can say what the learner has and where it ends.

**1b. Their goal: use the ungraded question tool.** "I want to understand X" can mean ten different things, and each changes what you teach. Ask until the goal is concrete: what they want to be able to do or explain, and to what depth. This has no right answer, so never use the quiz flow for it.

### Phase 2: Plan (think hard here)

This is the step where effort pays off most. With the learner's level and goal in hand, work out the best way to teach *this thing* to *this person*.

- **Scope the field first** (see Accuracy): find the topic's core concepts, its real first principles, the standard framings and the common gotchas.
- Identify the unconditional truths it rests on, and whether there is a clean atomic unit.
- Note which of those the learner already holds (from 1a). Build from there: not below it, not above it.
- Lay out the motivated discovery path from those truths to the goal.
- Decide Socratic or expository for each stretch.

**Present the plan before teaching, always.** It has three parts:

1. **Starting point, present state and goal, in one or two lines each.** State where the learner's edge sits on each strand (from 1a) and what they are reaching for (from 1b).
2. **The approach, in prose:** what you'll cover, in what order, and why this way.
3. **The dependency map:** a small ```mermaid``` graph (`graph TD`):
   - unconditional truths at the roots;
   - each derived node hanging off what it depends on;
   - the learner's goal as the final node.

   Give every node a short kebab-case id, such as `packets-atomic[Packets are atomic]`. Use that id as the `concept` on every quiz about the node. Mark nodes the learner already holds. Keep the map small: few nodes, short labels. This map *is* the teaching order.

**Stress-test the roots before presenting.** For each node you're treating as foundational, ask whether it really is an unconditional truth *for this learner*, or a hidden theorem that derives from something simpler. If it derives, push it down and extend the map.

**Then stop and wait for the learner's go-ahead.** A wrong root or wrong scope is cheap to fix now and expensive mid-lesson.

### Phase 3: Teach (the loop)

Build the graph one **node** at a time. Every node gets the same treatment, whether it is a foundational truth or a derived step:

1. **Motivate.** Say why we need this node now: what problem it solves, or what gap it closes. This applies to foundations too.
2. **Establish.**
   - For a foundational truth: state it plainly, at face value, with no caveats.
   - For a derived step: build it from what is already established through a motivated move, Socratic or expository, answering "how could I have discovered this?" A Socratic step with a right answer goes through the quiz flow (`purpose: "discovery"`).
3. **Connect.** Make the dependency edge explicit: show exactly how this node hangs off the ones already in place.
4. **Check.** Confirm the node landed with a quiz (`purpose: "check"`, `concept: <node id>`). If the learner misses it, the node isn't solid, so fix it before building anything on top.

Run the full loop for every node; don't front-load all the foundations and then stop checking. If you catch yourself asserting a fact the learner would have to take on faith, stop. Either motivate it and check that it landed, or ground it in something already established.

When you move between nodes, call `quiz_summary` if you've lost track of which nodes are solid.

### Closing a session

Sessions are self-contained: nothing persists after this one ends. When the learner wraps up:

1. Call `quiz_summary`.
2. Give a short recap covering:
   - the starting edge;
   - the nodes now established, with evidence;
   - open gaps and misconceptions;
   - the updated dependency map, with established nodes marked;
   - a suggested starting point for next time.
3. Keep the recap compact. The learner can paste it into their next session to pick up where they left off.

## Formatting

- Write math in LaTeX: `$f(x)$` inline, and `$$` on separate lines for display math. Most chat UIs and markdown viewers render it.
- Use fenced ```mermaid``` blocks for maps and structural diagrams. See the `visualize` skill.
