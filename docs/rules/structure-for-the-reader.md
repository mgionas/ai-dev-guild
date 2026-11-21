# Shape folders for the reader

Group by feature, not by kind. A test sits beside the file it tests. No `misc`, `utils` or `helpers` folder that collects what fits nowhere.

**Why:** File-count and line-count limits made folders flat and files arbitrary. The real question is whether someone new finds their way.

**How to apply:**

- Break up a file once it is hard to follow; join tiny files when a single file would be easier to read.
- Analyse the side effects of any new structure rule before adopting it.
- The 600-line figure in [folder guides hold current rules](guides-hold-current-rules.md) is a
  prompt to reread a guide, not a limit on it or on any file.

**Where it lives:** the `architect` review.

Origin: field-tested.
