---
name: visualize
description: Add one correct, minimal diagram to a lesson when an idea is clearer as a picture, such as a dependency graph, flow, sequence, state machine, tree, comparison, or simple geometry. Draws it inline as Mermaid (or SVG for geometry) and checks every element against what is being taught.
---

# Visualize

A picture earns its place only when it shows something words can't: shape, structure, direction, relationship, geometry. This skill adds ONE such picture to the lesson and makes sure it is **correct**.

## When to visualize, and when not to

The `teach` skill builds a dependency graph in the learner's head, with basic truths at the roots and derived facts hanging off them. A visual helps most when it makes that structure, or a geometry, visible. Reach for one when the idea is:

- **A structure or relationship:** dependencies, a system with parts and arrows, a flow or pipeline, a sequence of exchanges, a state machine, a tree or hierarchy, a comparison, or what is inside versus outside.
- **Spatial or geometric:** coordinates, a number line, vectors, the shape of a function, a physical arrangement.

Don't visualize when prose or a single equation already carries the idea. A decorative diagram that restates the sentence next to it adds noise and another chance to be wrong. When in doubt, leave it out: a missing visual costs less than a false one.

## Choose the form

- **Mermaid**, the default: anything made of nodes and edges or relationships. Use `graph TD` / `graph LR` for dependencies and flows. Also: `sequenceDiagram`, `stateDiagram-v2`, `erDiagram`, `mindmap`, `timeline`.
- **Inline SVG:** positions and shapes that Mermaid's automatic layout can't express, such as geometry figures, number lines, vectors, or simple plots. Use explicit coordinates, a `viewBox` with margins, and readable `font-family="sans-serif"` labels.

## One idea, fewest elements

The most common failure is **cramming**. Every extra label makes the picture harder to read and harder to lay out. Before drawing, cut to the fewest elements that carry the idea. For each one ask: *"If I delete this, is the idea still clear?"* If yes, delete it. Over ~7 nodes almost always means simplify.

- Labels are a term or a short phrase, never a sentence.
- Draw only what is being taught. Don't pad a thin idea with guesses.
- For dependency maps, put foundations at the top and conclusions below (`graph TD`), and use the same node ids the lesson's quizzes use as `concept`.

## Check before showing

You can't rely on seeing the rendered output, so check the source itself. Before you send it:

1. Read every edge aloud as a sentence ("A is needed for B"). Is each one true and pointing the right way?
2. Is every label correct and unambiguous?
3. Is anything asserted that hasn't been taught or verified? If you're unsure whether an edge is true, leave it out.
4. For SVG, recompute coordinates, angles and proportions deliberately rather than eyeballing them.

## Embed

Introduce the visual in one sentence, then put it in a fenced ```mermaid``` block, or as inline `<svg>` where the interface renders HTML. Let it carry the idea; don't narrate every element back in prose. If the interface turns out not to render Mermaid, the source is still readable as text. Keep it small for exactly that reason.
