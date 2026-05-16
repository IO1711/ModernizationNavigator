import { collectEnvironmentEvidenceV2 } from '@modernization-navigator/analysis-engine';
import {
  baseToolInputV2Schema,
  collectEnvironmentEvidenceResultSchema,
  type BaseToolInputV2,
  type CollectEnvironmentEvidenceResult
} from '@modernization-navigator/shared';

export async function collectEnvironmentEvidenceTool(
  input: BaseToolInputV2
): Promise<CollectEnvironmentEvidenceResult> {
  const parsedInput = baseToolInputV2Schema.parse(input);
  const result = await collectEnvironmentEvidenceV2(parsedInput);
  return collectEnvironmentEvidenceResultSchema.parse(result);
}
