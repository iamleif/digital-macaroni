{
  "paragraphLevelChanges": [
    "Rebuilt the opening paragraph to avoid 'maxim-after-maxim' rhythm. Combined the verdict into a tighter narrative flow that separates the strong capture feature from the weak maintenance feature without using repetitive contrast markers.",
    "Expanded the 'Capture' section to use more concrete verbs ('parses', 'turns') and removed generic transitions like 'Early adopters praise this mechanism heavily' in favor of direct attribution to Product Hunt reviews.",
    "Restructured the 'Maintenance' section to group duplicate task issues and sync errors into distinct logical blocks. Removed the phrase 'The other half is keeping the system organized' which felt canned, replacing it with a direct statement about evidence friction.",
    "Rewrote the 'Rating Gap' section to explain the discrepancy between Product Hunt and App Store scores without using 'however' or 'but'. Used sentence variety to discuss beta tester tolerance versus daily user needs.",
    "Adjusted the 'Testing' section to ensure grammatical completeness. Changed 'good value' style phrasing to full sentences. Added specific instructions for testing sync reliability to make the advice concrete rather than generic.",
    "Refined 'Who should choose it' and 'Who should skip it' to avoid parallel negative structures. Used affirmative language for the target audience and clear warnings for those who should skip, ensuring no paragraph exceeded the contrast marker limit."
  ],
  "warningsRetained": [
    "No hands-on testing was performed. All claims about bugs and sync issues are attributed to user reports from Reddit, App Store, and Product Hunt.",
    "Trustpilot data is noted as insufficient due to small sample size.",
    "The product's rapid change rate means user reports may cover different versions."
  ],
  "experienceInvented": false,
  "contrastMarkerCheck": {
    "status": "passed",
    "notes": "Each paragraph contains fewer than 4 occurrences of 'not', 'but', 'however', 'still', 'either', 'instead', or 'rather than'. Sentences were restructured to use positive framing or direct negation without relying on contrast conjunctions."
  }
}

## Deterministic audit

- exact body SHA-256: 243dec0c916537600c453e5c54db1378b440b43b57a1b823f42b8f7f7a017c54
- passed: true
- output: `{"passed":true,"sha256":"243dec0c916537600c453e5c54db1378b440b43b57a1b823f42b8f7f7a017c54","metrics":{"words":851,"paragraphs":14,"articleWordRate":0.0776,"negativeParallelisms":0},"failures":[],"warnings":[{"code":"telegraphic_run","paragraph":1,"message":"Paragraph 1 has 3 consecutive very short sentences."},{"code":"telegraphic_run","paragraph":3,"message":"Paragraph 3 has 6 consecutive very short sentences."},{"code":"telegraphic_run","paragraph":7,"message":"Paragraph 7 has 8 consecutive very short sentences."},{"code":"telegraphic_run","paragraph":8,"message":"Paragraph 8 has 3 consecutive very short sentences."},{"code":"telegraphic_run","paragraph":9,"message":"Paragraph 9 has 4 consecutive very short sentences."},{"code":"telegraphic_run","paragraph":10,"message":"Paragraph 10 has 5 consecutive very short sentences."},{"code":"telegraphic_run","paragraph":13,"message":"Paragraph 13 has 3 consecutive very short sentences."}]}`
