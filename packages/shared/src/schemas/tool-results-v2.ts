import { z } from 'zod';

import {
  COLLECT_ENVIRONMENT_EVIDENCE,
  COMPARE_UPGRADE_PATHS,
  DISCOVER_PROJECT_STACK,
  INSPECT_FRAMEWORK_DEPENDENCIES,
  INSPECT_PLATFORM_CONFIG,
  INSPECT_SOURCE_RISKS,
  SAVE_MODERNIZATION_REPORT_V2
} from '../constants/tool-names-v2';
import { issueSchema } from './report';
import { reportV2Schema } from './report-v2';
import { projectDescriptorSchema, stackProfileSchema, environmentEvidenceEntrySchema } from './stack-profile';
import {
  historyReportPathV2Schema,
  repoRootSchema,
  reportPathV2Schema,
  safeSubdirectorySchema,
  targetVersionSchema,
  workspaceTypeSchema
} from './primitives';

export const baseToolInputV2Schema = z
  .object({
    repoRoot: repoRootSchema,
    subdirectory: safeSubdirectorySchema.optional(),
    targetVersion: targetVersionSchema.optional(),
    offline: z.boolean().optional()
  })
  .strict();

export const discoverProjectStackResultSchema = z
  .object({
    repoRoot: repoRootSchema,
    subdirectory: safeSubdirectorySchema.optional(),
    workspaceType: workspaceTypeSchema,
    projectDescriptors: z.array(projectDescriptorSchema)
  })
  .strict();

export const collectEnvironmentEvidenceResultSchema = z
  .object({
    stackProfile: stackProfileSchema,
    projectDescriptors: z.array(projectDescriptorSchema),
    environmentEvidence: z.array(environmentEvidenceEntrySchema)
  })
  .strict();

export const inspectFrameworkDependenciesResultSchema = z
  .object({
    issues: z.array(issueSchema),
    summary: z.string().trim().min(1)
  })
  .strict();

export const inspectPlatformConfigResultSchema = z
  .object({
    issues: z.array(issueSchema),
    summary: z.string().trim().min(1)
  })
  .strict();

export const inspectSourceRisksResultSchema = z
  .object({
    issues: z.array(issueSchema),
    summary: z.string().trim().min(1)
  })
  .strict();

export const compareUpgradePathEntrySchema = z
  .object({
    label: z.string().trim().min(1),
    targetVersion: targetVersionSchema,
    riskScore: z.number(),
    effortScore: z.number(),
    blockers: z.array(z.string().trim().min(1))
  })
  .strict();

export const compareUpgradePathsResultSchema = z
  .object({
    comparedPaths: z.array(compareUpgradePathEntrySchema),
    recommendedPathCandidate: z.string().trim().min(1)
  })
  .strict();

export const saveModernizationReportV2InputSchema = z
  .object({
    report: reportV2Schema
  })
  .strict();

export const saveModernizationReportV2ResultSchema = z
  .object({
    reportId: z.string().trim().min(1),
    reportPath: reportPathV2Schema,
    historyPath: historyReportPathV2Schema
  })
  .strict();

export const toolInputSchemasV2 = {
  [DISCOVER_PROJECT_STACK]: baseToolInputV2Schema,
  [COLLECT_ENVIRONMENT_EVIDENCE]: baseToolInputV2Schema,
  [INSPECT_FRAMEWORK_DEPENDENCIES]: baseToolInputV2Schema,
  [INSPECT_PLATFORM_CONFIG]: baseToolInputV2Schema,
  [INSPECT_SOURCE_RISKS]: baseToolInputV2Schema,
  [COMPARE_UPGRADE_PATHS]: baseToolInputV2Schema,
  [SAVE_MODERNIZATION_REPORT_V2]: saveModernizationReportV2InputSchema
} as const;

export const toolResultSchemasV2 = {
  [DISCOVER_PROJECT_STACK]: discoverProjectStackResultSchema,
  [COLLECT_ENVIRONMENT_EVIDENCE]: collectEnvironmentEvidenceResultSchema,
  [INSPECT_FRAMEWORK_DEPENDENCIES]: inspectFrameworkDependenciesResultSchema,
  [INSPECT_PLATFORM_CONFIG]: inspectPlatformConfigResultSchema,
  [INSPECT_SOURCE_RISKS]: inspectSourceRisksResultSchema,
  [COMPARE_UPGRADE_PATHS]: compareUpgradePathsResultSchema,
  [SAVE_MODERNIZATION_REPORT_V2]: saveModernizationReportV2ResultSchema
} as const;
