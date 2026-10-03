# Asking a quiz question in each harness

`quiz_create` returns `options` as `[{ key: "A", label: "…" }, …]` in display order, plus `dontKnowOption: "I don't know"`. Show the learner exactly that, in that order, and nothing that hints at the answer. Then pass the learner's reply to `quiz_grade`.

## DeepSeek Harness (`dsh`)

Call `ask_user_question` with one question:

```json
{
  "questions": [{
    "id": "q3",
    "header": "Quiz",
    "question": "<question text, plus details if any>",
    "options": [
      { "label": "A. <label>" },
      { "label": "B. <label>" },
      { "label": "C. <label>" },
      { "label": "I don't know" }
    ]
  }]
}
```

- Use the `quizId` as the question `id`.
- For a multi-select quiz, set the multi-select flag the tool's schema offers, and tell the learner to select all that apply.
- The answer comes back as `{"answers":[{"id":"q3","selected":["B. <label>"],"custom":"…"}]}`. Pass `selected` to `quiz_grade` unchanged; it accepts the "B. label" form.
- If `custom` is present, the learner typed instead of choosing. Pass it as `selected` if it names an option, otherwise as `note`.

## Claude Code

`AskUserQuestion` allows 2–4 options per question and adds an "Other" free-text choice automatically. Use a `header` of 12 characters or fewer, such as "Quiz".

- **3 or fewer real options:** list them as "A. …", "B. …", and add "I don't know" as the last option.
- **Exactly 4 real options:** list all four and tell the learner in the question text to type "I don't know" under Other if they don't know.
- **More than 4 options:** ask in plain chat instead (see below).

Pass free text from Other to `quiz_grade` as `selected` if it names an option or is "I don't know". Otherwise pass it as `note` and ask again.

## OpenAI Codex, or any harness without a question tool

Ask in chat and end your turn:

```
**Quiz:** <question>

A. <label>
B. <label>
C. <label>
D. I don't know

Reply with a letter. Add a note after it if you like.
```

Pass the letter to `quiz_grade` as `selected` and any extra words as `note`.

## Always

- One question per message. Wait for the answer before grading.
- Never show `correctAnswer` or `explanation` before grading. Never say which option you like, or which one is "tricky."
- After grading, show `feedback` as returned, then continue teaching from the verdict.
