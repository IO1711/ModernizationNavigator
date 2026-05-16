import { discoverProjectStack } from '@modernization-navigator/analysis-engine';
import {
  baseToolInputV2Schema,
  discoverProjectStackResultSchema,
  type BaseToolInputV2,
  type DiscoverProjectStackResult
} from '@modernization-navigator/shared';

export async function discoverProjectStackTool(
  input: BaseToolInputV2
): Promise<DiscoverProjectStackResult> {
  const parsedInput = baseToolInputV2Schema.parse(input);
  const result = await discoverProjectStack(parsedInput);
  return discoverProjectStackResultSchema.parse(result);
}
