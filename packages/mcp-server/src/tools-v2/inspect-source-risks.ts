import { inspectSourceRisksV2 } from '@modernization-navigator/analysis-engine';
import {
  baseToolInputV2Schema,
  inspectSourceRisksResultSchema,
  type BaseToolInputV2,
  type InspectSourceRisksResult
} from '@modernization-navigator/shared';

export async function inspectSourceRisksTool(
  input: BaseToolInputV2
): Promise<InspectSourceRisksResult> {
  const parsedInput = baseToolInputV2Schema.parse(input);
  const result = await inspectSourceRisksV2(parsedInput);
  return inspectSourceRisksResultSchema.parse(result);
}
