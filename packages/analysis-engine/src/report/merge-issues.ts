import type { Issue } from '@modernization-navigator/shared';

export function mergeIssues(...issueLists: Issue[][]): Issue[] {
  const issueMap = new Map<string, Issue>();

  for (const issueList of issueLists) {
    for (const issue of issueList) {
      issueMap.set(issue.id, issue);
    }
  }

  return Array.from(issueMap.values());
}
