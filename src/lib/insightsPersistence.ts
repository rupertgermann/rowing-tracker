export interface CurrentInsightsPersistenceCandidate {
  insights?: readonly unknown[] | null;
}

export function shouldPersistCurrentInsights(
  result: CurrentInsightsPersistenceCandidate,
): boolean {
  return (result.insights?.length ?? 0) > 0;
}
