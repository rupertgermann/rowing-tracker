export interface ReplayComparisonStroke {
  strokeIndex: number;
}

export interface ReplayComparisonFault {
  strokeIndex: number;
  severity: string;
}

export interface FaultStrokeOption {
  strokeIndex: number;
  faultCount: number;
  severityScore: number;
}

export interface ReplayComparisonOptions {
  faultStrokeOptions: FaultStrokeOption[];
  cleanStrokeOptions: number[];
  defaultFaultStrokeIndex: number | null;
  defaultComparisonStrokeIndex: number | null;
}

export function buildReplayComparisonOptions(
  strokes: readonly ReplayComparisonStroke[],
  faults: readonly ReplayComparisonFault[],
  selectedFaultStrokeIndex: number | null = null,
): ReplayComparisonOptions {
  const knownStrokeIndexes = new Set(strokes.map((stroke) => stroke.strokeIndex));
  const faultStatsByStroke = new Map<number, FaultStrokeOption>();

  for (const fault of faults) {
    if (!knownStrokeIndexes.has(fault.strokeIndex)) continue;
    const current = faultStatsByStroke.get(fault.strokeIndex) ?? {
      strokeIndex: fault.strokeIndex,
      faultCount: 0,
      severityScore: 0,
    };
    current.faultCount += 1;
    current.severityScore += severityWeight(fault.severity);
    faultStatsByStroke.set(fault.strokeIndex, current);
  }

  const faultStrokeOptions = [...faultStatsByStroke.values()].sort(
    (a, b) =>
      b.severityScore - a.severityScore ||
      b.faultCount - a.faultCount ||
      a.strokeIndex - b.strokeIndex,
  );
  const cleanStrokeOptions = strokes
    .map((stroke) => stroke.strokeIndex)
    .filter((strokeIndex) => !faultStatsByStroke.has(strokeIndex))
    .sort((a, b) => a - b);
  const defaultFaultStrokeIndex = faultStrokeOptions[0]?.strokeIndex ?? null;
  const defaultComparisonStrokeIndex =
    cleanStrokeOptions.find((strokeIndex) => strokeIndex !== selectedFaultStrokeIndex) ??
    null;

  return {
    faultStrokeOptions,
    cleanStrokeOptions,
    defaultFaultStrokeIndex,
    defaultComparisonStrokeIndex,
  };
}

export function countFaultsForStroke(
  faults: readonly ReplayComparisonFault[],
  strokeIndex: number,
): number {
  return faults.filter((fault) => fault.strokeIndex === strokeIndex).length;
}

function severityWeight(severity: string): number {
  if (severity === "critical") return 5;
  if (severity === "warning") return 3;
  return 1;
}
