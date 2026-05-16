import { z } from 'zod';

import {
  nonEmptyStringSchema,
  safeRelativePathSchema,
  safeSubdirectorySchema
} from './primitives';

export const ecosystemSchema = z.enum([
  'node',
  'python',
  'spring',
  'flutter',
  'swiftui'
]);

export const frameworkSchema = z.enum([
  'node',
  'react',
  'fastapi',
  'django',
  'flask',
  'spring',
  'flutter',
  'swiftui'
]);

export const languageSchema = z.enum([
  'javascript',
  'typescript',
  'python',
  'java',
  'dart',
  'swift',
  'mixed'
]);

export const projectDescriptorSchema = z
  .object({
    rootPath: safeSubdirectorySchema,
    ecosystem: ecosystemSchema,
    framework: frameworkSchema,
    language: languageSchema,
    runtimeName: nonEmptyStringSchema,
    dependencyManager: nonEmptyStringSchema.optional(),
    buildSystem: nonEmptyStringSchema.optional(),
    confidence: z.number().min(0).max(1),
    markers: z.array(nonEmptyStringSchema)
  })
  .strict();

export const stackProfileSchema = z
  .object({
    ecosystem: ecosystemSchema,
    framework: frameworkSchema,
    language: languageSchema,
    runtimeName: nonEmptyStringSchema,
    dependencyManager: nonEmptyStringSchema.optional(),
    buildSystem: nonEmptyStringSchema.optional()
  })
  .strict();

export const environmentEvidenceEntrySchema = z
  .object({
    source: nonEmptyStringSchema,
    filePath: safeRelativePathSchema,
    value: nonEmptyStringSchema,
    kind: z.enum([
      'runtime',
      'framework',
      'dependency-manager',
      'build-system',
      'docker',
      'github-actions',
      'deployment',
      'script'
    ])
  })
  .strict();

export const externalDataSourceStatusSchema = z
  .object({
    source: nonEmptyStringSchema,
    status: z.enum(['used', 'skipped_offline', 'error']),
    notes: z.array(nonEmptyStringSchema).optional()
  })
  .strict();

export const externalDataStatusV2Schema = z
  .object({
    sources: z.array(externalDataSourceStatusSchema),
    notes: z.array(nonEmptyStringSchema)
  })
  .strict();
