# 11. AI Strategy

- Providers: pluggable (OpenAI/Azure/Anthropic/Google/DeepL)
- Prompting: TM examples, glossary, style, strict placeholder schema; include key/namespace context
- Validation: deterministic ICU/placeholder/glossary checker blocks acceptance
- Routing: short UI strings → LLM; long docs → MT; cost caps; caching
- Human‑in‑the‑loop: accept/modify/reject; auto‑review for low confidence
