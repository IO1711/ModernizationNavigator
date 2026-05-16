import { z } from 'zod';

import { TOOL_NAMES } from '../constants/tool-names';

const safePathSegmentPattern = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\/\/).+/;
const reportIdPattern =
  /^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?(?:-)?\d{8}T\d{6}Z$/i;
const relativeReportPathPattern =
  /^reports\/(?:latest\/report|history\/[A-Za-z0-9-]+)\.json$/;
const historyReportPathPattern = /^reports\/history\/[A-Za-z0-9-]+\.json$/;

export const isoTimestampSchema = z.string().datetime({ offset: true });

export const nonEmptyStringSchema = z.string().trim().min(1);

export const repoRootSchema = nonEmptyStringSchema;

export const reportIdSchema = z.string().regex(reportIdPattern, {
  message:
    'Report IDs must be timestamp-based, optionally prefixed, for deterministic history filenames.'
});

export const safeRelativePathSchema = z.string().regex(safePathSegmentPattern, {
  message: 'Paths must be relative, non-empty, and must not traverse upward.'
});

export const safeSubdirectorySchema = safeRelativePathSchema;

export const historyReportPathSchema = z.string().regex(historyReportPathPattern, {
  message: 'History report paths must live under reports/history/*.json.'
});

export const reportPathSchema = z.string().regex(relativeReportPathPattern, {
  message:
    'Report paths must resolve to reports/latest/report.json or reports/history/<reportId>.json.'
});

export const reportIndexPathSchema = z.literal('reports/index.json');

export const targetNodeVersionSchema = nonEmptyStringSchema;

export const packageManagerSchema = z.enum(['npm', 'pnpm', 'yarn']);

export const workspaceTypeSchema = z.enum(['single', 'monorepo']);

export const toolNameSchema = z.enum(TOOL_NAMES);
