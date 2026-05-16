import { compareTargetPaths as compareTargetPathsResult } from '@modernization-navigator/analysis-engine';
import {
  baseToolInputSchema,
  compareTargetPathsResultSchema,
  type BaseToolInput,
  type CompareTargetPathsResult
} from '@modernization-navigator/shared';

export async function compareTargetPaths(
  input: BaseToolInput
): Promise<CompareTargetPathsResult> {
  const parsedInput = baseToolInputSchema.parse(input);
  const result = compareTargetPathsResult({
    targetNodeVersion: parsedInput.targetNodeVersion
  });

  return compareTargetPathsResultSchema.parse(result);
}
