import { detectDependencyBlockers } from '@modernization-navigator/analysis-engine';
import {
  baseToolInputSchema,
  inspectDependencyBlockersResultSchema,
  type BaseToolInput,
  type InspectDependencyBlockersResult
} from '@modernization-navigator/shared';

export async function inspectDependencyBlockers(
  input: BaseToolInput
): Promise<InspectDependencyBlockersResult> {
  const parsedInput = baseToolInputSchema.parse(input);
  const result = await detectDependencyBlockers(parsedInput.repoRoot, parsedInput);
  return inspectDependencyBlockersResultSchema.parse(result);
}
