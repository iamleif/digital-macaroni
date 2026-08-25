---
name: digital-macaroni-humanizer
description: Edit Digital Macaroni software reviews so they sound naturally written without inventing hands-on experience. Use for review drafts that feel compressed, overly polished, mechanically balanced, template-shaped, or AI-generated; for final Humanizer passes in the enforced editorial pipeline; and when checking connective words, articles, paragraph choreography, contrast patterns, cadence, and brand voice before approval.
---

# Digital Macaroni Humanizer

Edit for a human reader, not an AI detector. Keep the writer's argument and evidence intact. Remove the statistical habits that make every paragraph feel assembled from the same kit.

Read `references/ai-writing-patterns.md` before editing a review. Also read the repository's `humanizer-context.md` when present.

## Non-negotiable boundaries

- Do not invent product use, reactions, scenes, quotes, or first-person experience.
- Do not turn a proposed buyer check into something Digital Macaroni performed.
- Do not weaken a clear recommendation merely to sound balanced.
- Do not use deliberate mistakes, slang, random fragments, or fake tangents as camouflage.
- Do not optimize toward an AI-detector score. Pattern removal without better prose is failure.
- Do not mark a draft as passed after changing it unless the exact changed body is audited again.

## Editing workflow

### 1. State the piece's mind

Before changing a line, write down:

- the buyer;
- the decision being made;
- the writer's actual opinion;
- the one uncertainty that remains.

If these are vague, return the draft to the writer. A Humanizer cannot add a point of view that was never developed.

### 2. Restore ordinary syntax

Read every sentence aloud. Restore the small words that natural speech needs: `a`, `an`, `the`, `that`, `of`, `to`, and simple `is`, `are`, `has`, and `have` constructions.

Do not confuse compression with confidence.

- Compressed: `Akiflow is not broadly good value.`
- Natural: `Akiflow is not broadly a good value.`

Isolated wordiness can be human. Keep a harmless `very`, `a bit`, `the fact that`, or `in order to` when it makes the sentence sound like this writer. Delete filler only when it hides the point or becomes a repeated habit.

Prefer the plain verb. Write `is`, `has`, `used`, `wrote`, `moved`, and `tried` when the fancier alternative carries no extra meaning.

### 3. Break paragraph choreography

Label what each sentence is doing. A paragraph is suspect when the labels form a perfect sequence such as:

`old evidence -> concession -> current evidence -> principle -> neat takeaway`

That is the problem in this passage:

> Older complaints about mobile should not be treated as a review of today's app. They should not be ignored either. Recent release notes still mention fixes. Feature parity is not the standard here. A change made in one place simply needs to remain true everywhere else.

The sentences are individually competent. Together they sound staged. Rewrite the thought as someone would actually explain it, usually by combining the first two sentences, dropping the abstract principle, and landing on the specific concern.

Do not force every paragraph to contain a claim, caveat, evidence sentence, and conclusion. Let one paragraph explain. Let another object. A short paragraph may do nothing except sharpen the sentence before it.

### 4. Audit contrasts

Search for `not`, `but`, `however`, `still`, `either`, `rather than`, and `instead`. One contrast is ordinary. Several in a paragraph create the synthetic feeling of a model balancing both sides.

Pay special attention to:

- `not X, but Y`;
- `not only X, but also Y`;
- two consecutive `should not` sentences;
- `X is true. It should not be ignored either.`;
- a caveat immediately canceled by a reassurance.

Choose the side the paragraph is actually about. Keep the one caveat that changes the recommendation.

### 5. Remove editorial stage directions

Delete sentences that tell the reader how to interpret the neighboring sentences instead of adding information:

- `That distinction matters.`
- `Feature parity is not the standard here.`
- `This is where the promise becomes fragile.`
- `The decision is simple.`

Occasionally one earns its place. A run of them is a tell. Prefer the fact that makes the interpretation unavoidable.

### 6. Check the whole article, not only phrases

Look for structural repetition:

- similar section lengths;
- the same number of sentences in most paragraphs;
- every section ending with buyer advice;
- repeated miniature conclusions;
- headings that could be swapped without disrupting the argument;
- the same `claim -> evidence -> warning -> test` sequence in each section.

Reorder, merge, or cut until the argument develops rather than resets.

### 7. Preserve Digital Macaroni's voice

The voice is plain, skeptical, specific, and useful. It can be dry. It should not sound hostile or artificially blunt.

Use contractions naturally. Address the buyer as `you` when it prevents detached prose. Repeat the exact product term instead of cycling through synonyms. Allow a sentence to be slightly longer when the thought needs qualification.

Strong writing is not the fewest possible words. It is the fewest words that still sound like somebody meant them.

### 8. Run the deterministic audit

Run:

```bash
node .agents/skills/digital-macaroni-humanizer/scripts/audit-prose.mjs <draft-file>
```

Treat failures as blockers. Treat warnings as prompts for a read-aloud check, not automatic rewrite orders.

### 9. Produce the report

Record:

- exact draft path and SHA-256;
- every paragraph-level pattern changed;
- any warning consciously retained and why;
- confirmation that no experience was invented;
- audit output;
- `passed: true` only when the final body itself was audited.

The report must explain editorial choices. `Humanized for flow` is not a report.

## Final read

Read the draft once without looking for patterns. Ask only: would Leif say it this way?

If the answer is “almost,” it is not ready.
