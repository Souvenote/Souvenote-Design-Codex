# Legacy documentation

Everything below `docs/legacy/` is retained only as historical evidence. It is explicitly non-authoritative, including Markdown, PDF, screenshots, API examples, SQL instructions, environment-variable lists, paths, prices, currencies, identity fields, status models, and descriptions of mock success.

Do not execute commands or implement behavior from these files without reconciling it against, in order:

1. `docs/product/decision-register.md`
2. `docs/product/mvp-spec.md`
3. `AGENTS.md`
4. `docs/engineering/architecture.md`
5. `docs/engineering/local-development.md`

Known legacy material includes unsafe caller-supplied identity, USD defaults, speculative schema ideas, manual SQL state changes, obsolete paths, and simulated transaction behavior. Its presence does not approve those patterns.

The historical files are not being rewritten to resemble current design. Short warning banners may be added to make their status unambiguous; otherwise retain their original content for traceability. When a legacy statement matters to active work, cite the conflict in the current task and use the decision register rather than silently choosing it.
