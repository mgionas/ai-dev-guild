# Optional roles

These two roles are **not loaded by the plugin.** They suit products that handle money or several
languages, so they live here. Copy the one you need into your project's `.claude/agents/`, then
read it and adjust it to your rules.

| Role                                      | Use it for                                                          | Its page                                             |
| ----------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| [`money-specialist`](money-specialist.md) | Building or reviewing code that computes, stores or moves money     | [money-specialist-role.md](money-specialist-role.md) |
| [`i18n`](i18n.md)                         | Keeping translation files complete and consistent with the glossary | [i18n-role.md](i18n-role.md)                         |

Once copied, the role is called by its plain name (`money-specialist`, not
`ai-dev-guild:money-specialist`). The optional [international rule](../../docs/rules/international-by-default.md)
goes well with both.
