export function extractMajorVersion(value?: string): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/\d+/);
  const major = match ? Number.parseInt(match[0], 10) : Number.NaN;
  return Number.isFinite(major) ? major : null;
}

export function extractAllMajorVersions(value?: string): number[] {
  if (!value) {
    return [];
  }

  const matches = value.match(/\d+/g) ?? [];
  return matches
    .map((segment) => Number.parseInt(segment, 10))
    .filter((segment) => Number.isFinite(segment));
}

export function rangeSeemsToSupportMajor(
  range: string | undefined,
  targetMajor: number
): boolean {
  if (!range) {
    return true;
  }

  const normalizedRange = range.replace(/\s+/g, ' ').trim();

  if (normalizedRange.includes('||')) {
    return normalizedRange
      .split('||')
      .some((segment) => rangeSeemsToSupportMajor(segment.trim(), targetMajor));
  }

  if (new RegExp(`<\\s*${targetMajor}(?:\\D|$)`).test(normalizedRange)) {
    return false;
  }

  if (targetMajor > 0) {
    const previousMajor = targetMajor - 1;

    if (new RegExp(`<=\\s*${previousMajor}(?:\\D|$)`).test(normalizedRange)) {
      return false;
    }
  }

  if (new RegExp(`\\b${targetMajor}\\b`).test(normalizedRange)) {
    return true;
  }

  const minimumMajorMatch = normalizedRange.match(/>=\s*(\d+)/);

  if (minimumMajorMatch) {
    return targetMajor >= Number.parseInt(minimumMajorMatch[1], 10);
  }

  const declaredMajors = extractAllMajorVersions(normalizedRange);

  if (
    declaredMajors.length === 1 &&
    /^[\^~]?\d+(?:\.\d+)?(?:\.\d+)?/.test(normalizedRange)
  ) {
    return declaredMajors[0] === targetMajor;
  }

  return declaredMajors.length === 0;
}

export function pickMostCommonMajor(values: Array<string | undefined>): number | null {
  const counts = new Map<number, number>();

  for (const value of values) {
    const major = extractMajorVersion(value);

    if (major === null) {
      continue;
    }

    counts.set(major, (counts.get(major) ?? 0) + 1);
  }

  const rankedMajors = Array.from(counts.entries()).sort((left, right) => {
    return right[1] - left[1] || left[0] - right[0];
  });

  return rankedMajors[0]?.[0] ?? null;
}

export function sanitizeIssueIdPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function compareNumbers(left: number, right: number): number {
  return left === right ? 0 : left < right ? -1 : 1;
}
