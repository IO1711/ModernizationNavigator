import { collectRuntimeEvidenceEntries } from '@modernization-navigator/analysis-engine';
import {
  baseToolInputSchema,
  collectRuntimeEvidenceResultSchema,
  type BaseToolInput,
  type CollectRuntimeEvidenceResult
} from '@modernization-navigator/shared';

export async function collectRuntimeEvidence(
  input: BaseToolInput
): Promise<CollectRuntimeEvidenceResult> {
  const parsedInput = baseToolInputSchema.parse(input);

  return collectRuntimeEvidenceResultSchema.parse({
    runtimeEvidence: await collectRuntimeEvidenceEntries(
      parsedInput.repoRoot,
      parsedInput.subdirectory
    )
  });
}
