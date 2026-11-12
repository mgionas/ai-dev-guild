/**
 * The rules that keep the map true. It takes the facts read from the code and the map people
 * wrote, and returns every way they disagree, one sentence each. It reads nothing itself.
 */
export const KINDS = ["operations", "screens", "tables"];
const LABEL = new Map([["operations", "operation"], ["screens", "screen"], ["tables", "table"]]);

/**
 * @param {Record<string, {id: string}[]>} facts - what each reader found; a kind left out is empty.
 * @param {{features: object[], undescribed: Record<string, string[]>}} map
 * @returns {string[]} the problems; empty when the map is true.
 */
export function compare(facts, { features, undescribed }) {
  const problems = [];
  for (const kind of KINDS) {
    const what = LABEL.get(kind);
    const real = new Set((facts[kind] ?? []).map((f) => f.id));
    const claimed = new Set();
    const owner = new Map();
    for (const feature of features) {
      for (const id of feature[kind]) {
        claimed.add(id);
        // A shared item belongs to a feature of its own ("shared ..."): the map says who owns it, once.
        if (owner.has(id)) problems.push(`${feature.file}: feature "${feature.id}" names the ${what} ${id}, which feature "${owner.get(id)}" already owns`);
        else owner.set(id, feature.id);
        if (!real.has(id)) problems.push(`${feature.file}: feature "${feature.id}" names the ${what} ${id}, which does not exist in the code`);
      }
    }
    const baseline = new Set(undescribed[kind]);
    for (const id of [...real].sort()) {
      if (!claimed.has(id) && !baseline.has(id)) problems.push(`The ${what} ${id} belongs to no feature: describe it in a features file (undescribed.yaml only shrinks, never add to it)`);
    }
    for (const id of undescribed[kind]) {
      if (!real.has(id)) problems.push(`undescribed.yaml lists the ${what} ${id}, which no longer exists: remove it`);
      else if (claimed.has(id)) problems.push(`undescribed.yaml lists the ${what} ${id}, which a feature now describes: remove it`);
    }
  }
  return problems;
}
