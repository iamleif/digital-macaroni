---
name: digital-macaroni-review-writer
description: Turn product facts, user-review research, community discussions, testing notes, and evidence packets into plainspoken Digital Macaroni software reviews. Use when drafting, rewriting, or diagnosing a Digital Macaroni review; when an article reads like source aggregation, marketing copy, or analyst prose; or when converting research into an editorial recommendation without inventing hands-on experience.
---

# Digital Macaroni review writer

Write the review you would give a friend who asked whether the software is any good. Explain what it does in ordinary language, say who will find it useful, and be honest about where it becomes annoying or risky.

This is editorial writing, not a product summary, literature review, sales page, or simulated hands-on account.

## Read project context

Read `research/ARTICLE_BRIEF.md` and `humanizer-context.md` when present. Read [writer-notebook.md](references/writer-notebook.md) before shaping evidence, and [voice-examples.md](references/voice-examples.md) before drafting.

Factual accuracy and disclosure rules are binding. Readability scores, fixed outlines, and voice labels are warnings or defaults, not reasons to make the prose choppy.

## Build the writer's notebook

Convert the evidence packet into the notebook schema before drafting.

- Separate verified product facts, reported patterns, and hands-on observations.
- Record the situation behind each useful account: portfolio size, task, connected service, event, result, and response.
- Give more weight to detailed, recent accounts than ratings without context.
- Record conflicts instead of averaging them away.
- Write a plain-language translation for every product term the average reader may not know.
- Record who would care about each feature and when that feature would not matter.
- List missing details. Never fill a gap with an imagined scene or generic advice.

If the packet has only themes and counts, say that it supports a verdict but lacks writing texture. Enrich it from the named sources when authorized and possible.

## Keep strategy private

Write a private argument card with the buyer, job, thesis, reason to buy, reason to hesitate, decision rule, and evidence limit. These are planning labels. They must not appear in the article.

Do not write phrases such as “the case is weaker,” “earns its place,” “the value proposition,” “buyer fit,” “operational complexity,” “becomes more compelling,” “limits our recommendation,” or “the part we trust least.” Those phrases describe an analysis. They do not sound like a review.

## Write a spoken review brief

Before the article, answer these questions in the language you would use out loud:

- What is this product, without using the company's category label?
- Who will find it useful?
- What does its main feature let that person do?
- Is the feature good, merely good enough, limited, annoying, or unreliable?
- When will that feature not matter?
- What happened to real customers that changed our opinion?
- What would we tell a friend to check before paying?

The spoken brief is the bridge between research and prose. Draft from it, not directly from JSON, source counts, or the argument card.

## Draft in normal language

Explain the product before naming its jargon. For example, write “when an Airbnb booking comes in, Lodgify should block those dates on Vrbo and your own site” before using “calendar sync.” Skip the technical term if the reader does not need it.

For each important feature, cover what it does, who needs it, whether it works well enough, its main limit, and when it will not matter. Let those ideas form a natural paragraph. Do not force a fixed sentence formula.

Use ordinary judgments: “useful,” “limited,” “gets the job done,” “slow,” “confusing,” and “not worth paying for.” Prefer a concrete action over an abstract noun. Say “move six existing bookings” instead of “complete a live migration.” Say “host” instead of “operator” and “steps” instead of “workflow.”

Use “we” only for a real Digital Macaroni opinion or recommendation. Do not sprinkle it through the article to perform authority.

Keep the frontmatter `verdict` and `cardVerdict` identical, eight or nine words long, and no more than 64 characters. This is the large review-page headline, so it must state one clear judgment rather than summarize the full article.

Sections should answer normal reader concerns. Headings may be plain statements such as “The website builder is useful if you need one” and “Calendar problems are the main concern.” Do not build the article around the company's pricing tiers or feature categories.

## Protect authenticity

- Never claim or imply product use that did not happen.
- Never turn a reported pattern into a universal product fact.
- Keep the research disclosure in metadata; mention a limitation in prose only when it changes the recommendation.
- Never invent customer stories, sensory details, jokes, dialogue, prices, features, or certainty.
- Do not narrate sample counts or repeatedly say “reviews show.” Attribute a source only when needed to keep a reported claim honest.
- Do not write miniature disaster scenes to make a risk feel dramatic. Describe the real event and its result.
- Do not defend every numeric score in the body.

## Edit with restraint

First, run a copy edit for clarity, flow, proof, specificity, and paragraph order. Skip conversion tactics, manufactured emotion, calls to action, and sales language. Keep connected reasoning even when a readability tool prefers shorter sentences.

Then use Humanizer in detect or targeted edit mode only. Do not apply its `blunt` voice. Fix clusters of AI patterns, not isolated words. Do not add slang, metaphors, fake experience, or “soul.”

Read the piece aloud and ask:

- Could a host understand every term without knowing software marketing language?
- Does each paragraph explain something or make a useful judgment?
- Could a real person say these sentences in conversation?
- Do adjacent paragraphs build on each other, or could they be shuffled without anyone noticing?
- If the source-attribution sentences vanished, would our opinion still be clear?

## Deliver artifacts

Save these separately so an editor can compare them:

1. Writer's notebook
2. Private argument card
3. Spoken review brief
4. Raw draft
5. Copy-edited draft
6. Humanizer report and final draft

Run the content validator last. Do not publish until the user approves the final draft.
