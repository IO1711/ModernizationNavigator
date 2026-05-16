import { z } from 'zod';

import {
  environmentEvidenceEntrySchema,
  externalDataStatusV2Schema,
  projectDescriptorSchema,
  stackProfileSchema
} from '../schemas/stack-profile';
import {
  reportManifestEntryV2Schema,
  reportManifestV2Schema
} from '../schemas/manifest-v2';
import { reportV2Schema, toolTraceEntryV2Schema } from '../schemas/report-v2';

export type StackProfile = z.infer<typeof stackProfileSchema>;
export type ProjectDescriptor = z.infer<typeof projectDescriptorSchema>;
export type EnvironmentEvidenceEntry = z.infer<typeof environmentEvidenceEntrySchema>;
export type ExternalDataStatusV2 = z.infer<typeof externalDataStatusV2Schema>;
export type ToolTraceEntryV2 = z.infer<typeof toolTraceEntryV2Schema>;
export type ReportV2 = z.infer<typeof reportV2Schema>;
export type ReportManifestEntryV2 = z.infer<typeof reportManifestEntryV2Schema>;
export type ReportManifestV2 = z.infer<typeof reportManifestV2Schema>;
