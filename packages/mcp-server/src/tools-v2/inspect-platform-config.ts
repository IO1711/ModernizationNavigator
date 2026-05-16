import { inspectPlatformConfigV2 } from '@modernization-navigator/analysis-engine';
import {
  baseToolInputV2Schema,
  inspectPlatformConfigResultSchema,
  type BaseToolInputV2,
  type InspectPlatformConfigResult
} from '@modernization-navigator/shared';

export async function inspectPlatformConfigTool(
  input: BaseToolInputV2
): Promise<InspectPlatformConfigResult> {
  const parsedInput = baseToolInputV2Schema.parse(input);
  const result = await inspectPlatformConfigV2(parsedInput);
  return inspectPlatformConfigResultSchema.parse(result);
}
