import fs from 'node:fs';
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
  ),
  reactFrameworkRules: path.resolve(
    __dirname,
    '../data/ecosystems/node/react-rules.json'
  )
} as const;

export type RuleAlternativeSolution = {
  rank: number;
  title: string;
  summary: string;
  targetVersionRange: string;
  rationale: string;
  tradeoffs: string[];
  commands: string[];
};

type BaseKnowledgeRule = {
  id: string;
  incompatibilityReason: string;
  defaultTechnicalRecommendation: string;
  alternativeSolutions?: RuleAlternativeSolution[];
  evidenceHints: string[];
};

export type NodeRuntimeRule = BaseKnowledgeRule & {
  match: {
    currentNodeRange?: string;
  };
};

export type PackageCompatibilityRule = BaseKnowledgeRule & {
  match: {
    packagePatterns?: string[];
    scriptPatterns?: string[];
  };
};

export type CiRuntimeRule = BaseKnowledgeRule & {
  match: {
    workflowPattern?: string;
  };
};

export type DeploymentRuntimeRule = BaseKnowledgeRule & {
  match: {
    deploymentFiles?: string[];
  };
};

export type ReactFrameworkRule = BaseKnowledgeRule & {
  title: string;
  match: {
    packageName?: string;
    maxRecommendedMajor?: number;
  };
};

function readRuleFile<T>(filePath: string): ReadonlyArray<T> {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

let cachedNodeRuntimeRules: ReadonlyArray<NodeRuntimeRule> | null = null;
let cachedPackageCompatibilityRules: ReadonlyArray<PackageCompatibilityRule> | null =
  null;
let cachedCiRuntimeRules: ReadonlyArray<CiRuntimeRule> | null = null;
let cachedDeploymentRuntimeRules: ReadonlyArray<DeploymentRuntimeRule> | null = null;
let cachedReactFrameworkRules: ReadonlyArray<ReactFrameworkRule> | null = null;

export function loadNodeRuntimeRules(): ReadonlyArray<NodeRuntimeRule> {
  cachedNodeRuntimeRules ??= readRuleFile<NodeRuntimeRule>(
    KNOWLEDGE_BASE_FILES.nodeRuntimeRules
  );
  return cachedNodeRuntimeRules;
}

export function loadPackageCompatibilityRules(): ReadonlyArray<PackageCompatibilityRule> {
  cachedPackageCompatibilityRules ??= readRuleFile<PackageCompatibilityRule>(
    KNOWLEDGE_BASE_FILES.packageCompatibilityRules
  );
  return cachedPackageCompatibilityRules;
}

export function loadCiRuntimeRules(): ReadonlyArray<CiRuntimeRule> {
  cachedCiRuntimeRules ??= readRuleFile<CiRuntimeRule>(
    KNOWLEDGE_BASE_FILES.ciRuntimeRules
  );
  return cachedCiRuntimeRules;
}

export function loadDeploymentRuntimeRules(): ReadonlyArray<DeploymentRuntimeRule> {
  cachedDeploymentRuntimeRules ??= readRuleFile<DeploymentRuntimeRule>(
    KNOWLEDGE_BASE_FILES.deploymentRuntimeRules
  );
  return cachedDeploymentRuntimeRules;
}

export function loadReactFrameworkRules(): ReadonlyArray<ReactFrameworkRule> {
  cachedReactFrameworkRules ??= readRuleFile<ReactFrameworkRule>(
    KNOWLEDGE_BASE_FILES.reactFrameworkRules
  );
  return cachedReactFrameworkRules;
}
