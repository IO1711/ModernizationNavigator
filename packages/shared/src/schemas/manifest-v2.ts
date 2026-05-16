import { z } from 'zod';

import {
  frameworkSchema,
  ecosystemSchema
} from './stack-profile';
import {
  historyReportPathV2Schema,
  isoTimestampSchema,
  reportIdSchema,
  reportPathV2Schema,
  safeSubdirectorySchema,
  targetVersionSchema
} from './primitives';

export const reportManifestEntryV2Schema = z
  .object({
    reportId: reportIdSchema,
    createdAt: isoTimestampSchema,
    reportPath: historyReportPathV2Schema,
    ecosystem: ecosystemSchema,
    framework: frameworkSchema,
    requestedTargetVersion: targetVersionSchema,
    subdirectory: safeSubdirectorySchema.optional()
  })
  .strict();

export const reportManifestV2Schema = z
  .object({
    latestReportPath: reportPathV2Schema,
    history: z.array(reportManifestEntryV2Schema)
  })
  .strict();
