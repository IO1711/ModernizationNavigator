import { detectSourceCompatibilityIssues } from '@modernization-navigator/analysis-engine';
import {
  baseToolInputSchema,
  inspectSourceCompatibilityResultSchema,
  type BaseToolInput,
  type InspectSourceCompatibilityResult
} from '@modernization-navigator/shared';

export async function inspectSourceCompatibility(
  input: BaseToolInput
): Promise<InspectSourceCompatibilityResult> {
  const parsedInput = baseToolInputSchema.parse(input);
  const result = await detectSourceCompatibilityIssues(parsedInput.repoRoot, parsedInput);
  return inspectSourceCompatibilityResultSchema.parse(result);
}
