import assert from "node:assert/strict";
import { test } from "node:test";
import { parseStatus, probeProblem, snapshot } from "./probe.mjs";

/** A fake checkout: git's status text and the files' bytes, by path. */
const fake = (status, files) =>
  snapshot(
    "/unused",
    () => status,
    (path) => (Object.hasOwn(files, path) ? Buffer.from(files[path]) : null),
  );

test("parseStatus lists both sides of a rename", () => {
  assert.deepEqual(parseStatus(" M a.txt\0R  new.txt\0old.txt\0?? b.txt\0"), [
    [" M", "a.txt"],
    ["R ", "new.txt"],
    ["R ", "old.txt"],
    ["??", "b.txt"],
  ]);
});

test("a step that changes nothing passes", () => {
  const before = fake(" M a.txt\0", { "a.txt": "1" });
  const after = fake(" M a.txt\0", { "a.txt": "1" });
  assert.equal(probeProblem(before, after), null);
});

test("a new untracked file is named", () => {
  const before = fake("", {});
  const after = fake("?? out/gen.ts\0", { "out/gen.ts": "x" });
  assert.match(probeProblem(before, after), /changed the working tree: out\/gen\.ts$/);
});

test("rewriting a file that was already modified is seen, though its status line did not move", () => {
  const before = fake(" M a.txt\0", { "a.txt": "1" });
  const after = fake(" M a.txt\0", { "a.txt": "2" });
  assert.match(probeProblem(before, after), /a\.txt/);
});

test("a file the step reverted or deleted is named", () => {
  const before = fake(" M a.txt\0 M b.txt\0", { "a.txt": "1", "b.txt": "1" });
  const after = fake(" D b.txt\0", {});
  assert.match(probeProblem(before, after), /a\.txt, b\.txt/);
});

test("when git cannot answer, the step fails rather than reading as clean", () => {
  assert.equal(snapshot("/unused", () => null), null);
  assert.match(probeProblem(null, new Map()), /cannot be shown/);
  assert.match(probeProblem(new Map(), null), /cannot be shown/);
});
