# Assume no country

Write code that works anywhere. A local convention (one currency, one time zone, one language, one
country's tax or holidays) is only built in when the project's rules say the product is limited to
it.

**Why:** Agents fill gaps with the conventions they have seen most, and those are rarely the ones
your users live with. A hard-coded `* 100`, a server's local time or a `MM/DD/YYYY` pattern works in
the demo and breaks for the first customer elsewhere, and it is costly to unpick once data is stored
that way.

**How to apply:**

- Money: an integer in the currency's minor unit, always stored with its ISO 4217 code. Read the
  number of decimals from the currency; do not assume 2.
- Time: store instants in UTC; keep the user's or the place's IANA time zone (`Europe/Paris`, not
  `+01:00`) and convert at the edges. Test across a daylight-saving change.
- Dates and numbers: ISO 8601 in data; the locale (`Intl` or a CLDR-based library) on screen.
- Text: every string through translation files, with the language's plural rules; layouts that
  survive right-to-left and long translations.
- Phone numbers in E.164 and addresses through a maintained library; never one country's format.
- Tax, holidays, legal wording and payment methods are per-country rules the owner provides.

**Where it lives:** the `builder`, `money-specialist`, `i18n`, `qa-tester` and `domain-guardian`
roles; the `AGENTS.md` template.

Origin: new.
