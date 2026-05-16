import { compareUpgradePathsV2 } from '@modernization-navigator/analysis-engine';
import {
  baseToolInputV2Schema,
  compareUpgradePathsResultSchema,
  type BaseToolInputV2,
  type CompareUpgradePathsResult
} from '@modernization-navigator/shared';

export async function compareUpgradePathsTool(
  input: BaseToolInputV2
): Promise<CompareUpgradePathsResult> {
  const parsedInput = baseToolInputV2Schema.parse(input);
  const result = await compareUpgradePathsV2(parsedInput);
  return compareUpgradePathsResultSchema.parse(result);
}
