import path from 'node:path';

export const KNOWLEDGE_BASE_FILES = {
  nodeRuntimeRules: path.resolve(__dirname, '../data/node-runtime-rules.json'),
  packageCompatibilityRules: path.resolve(
    __dirname,
    '../data/package-compatibility-rules.json'
  ),
  ciRuntimeRules: path.resolve(__dirname, '../data/ci-runtime-rules.json'),
  deploymentRuntimeRules: path.resolve(
    __dirname,
    '../data/deployment-runtime-rules.json'
  )
} as const;
