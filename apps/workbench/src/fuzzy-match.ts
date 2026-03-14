type MatchConfig = {
  boostPrefix?: number;
};

const DEFAULT_CONFIG: MatchConfig = {
  boostPrefix: 0.2
};

export function fuzzyScore(query: string, target: string, config: MatchConfig = DEFAULT_CONFIG) {
  if (!target) return 0;
  if (!query) return 0.0001;
  const normalizedQuery = query.toLowerCase();
  const normalizedTarget = target.toLowerCase();
  if (normalizedQuery === normalizedTarget) return 1;
  let score = 0;
  let qIndex = 0;
  let prevMatchIndex = -1;
  for (let i = 0; i < normalizedTarget.length && qIndex < normalizedQuery.length; i++) {
    if (normalizedTarget[i] === normalizedQuery[qIndex]) {
      score += 0.1;
      if (prevMatchIndex >= 0 && i === prevMatchIndex + 1) {
        score += 0.05;
      }
      prevMatchIndex = i;
      qIndex += 1;
    }
  }
  if (qIndex < normalizedQuery.length) {
    return 0;
  }
  if (normalizedTarget.startsWith(normalizedQuery)) {
    score += config.boostPrefix ?? 0;
  }
  const lengthPenalty = Math.max(target.length - query.length, 0) * 0.002;
  return Math.max(0, Math.min(1, score - lengthPenalty));
}
