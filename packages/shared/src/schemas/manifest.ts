import { z } from 'zod';

import {
  isoTimestampSchema,
  reportIdSchema,
  reportPathSchema,
  safeSubdirectorySchema,
  targetNodeVersionSchema
} from './primitives';

export const reportManifestEntrySchema = z
  .object({
    reportId: reportIdSchema,
    createdAt: isoTimestampSchema,
    reportPath: reportPathSchema,
    requestedTargetNodeVersion: targetNodeVersionSchema,
    subdirectory: safeSubdirectorySchema.optional()
  })
  .strict();

export const reportManifestSchema = z
  .object({
    latestReportPath: reportPathSchema,
    history: z.array(reportManifestEntrySchema)
  })
  .strict();
