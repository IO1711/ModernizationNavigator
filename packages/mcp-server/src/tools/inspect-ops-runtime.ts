import { detectOpsRuntimeIssues } from '@modernization-navigator/analysis-engine';
import {
  baseToolInputSchema,
  inspectOpsRuntimeResultSchema,
  type BaseToolInput,
  type InspectOpsRuntimeResult
} from '@modernization-navigator/shared';

export async function inspectOpsRuntime(
  input: BaseToolInput
): Promise<InspectOpsRuntimeResult> {
  const parsedInput = baseToolInputSchema.parse(input);
  const result = await detectOpsRuntimeIssues(parsedInput.repoRoot, parsedInput);
  return inspectOpsRuntimeResultSchema.parse(result);
}
