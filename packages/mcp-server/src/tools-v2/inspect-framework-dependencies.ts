import { inspectFrameworkDependenciesV2 } from '@modernization-navigator/analysis-engine';
import {
  baseToolInputV2Schema,
  inspectFrameworkDependenciesResultSchema,
  type BaseToolInputV2,
  type InspectFrameworkDependenciesResult
} from '@modernization-navigator/shared';

export async function inspectFrameworkDependenciesTool(
  input: BaseToolInputV2
): Promise<InspectFrameworkDependenciesResult> {
  const parsedInput = baseToolInputV2Schema.parse(input);
  const result = await inspectFrameworkDependenciesV2(parsedInput);
  return inspectFrameworkDependenciesResultSchema.parse(result);
}
