import { z } from 'zod';

export const reportManifestSchema = z.object({
  latestReportPath: z.string(),
  history: z.array(
    z.object({
      reportId: z.string(),
      createdAt: z.string(),
      reportPath: z.string(),
      requestedTargetNodeVersion: z.string(),
      subdirectory: z.string().optional()
    })
  )
});
