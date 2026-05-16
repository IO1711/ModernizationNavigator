#!/usr/bin/env node
/**
 * Direct analysis script for old-node-app repository
 * This bypasses MCP and calls the tool implementations directly
 */

import { discoverRepoScope } from '../packages/mcp-server/src/tools/discover-repo-scope';
import { collectRuntimeEvidence } from '../packages/mcp-server/src/tools/collect-runtime-evidence';
import { inspectDependencyBlockers } from '../packages/mcp-server/src/tools/inspect-dependency-blockers';
import { inspectOpsRuntime } from '../packages/mcp-server/src/tools/inspect-ops-runtime';
import { inspectSourceCompatibility } from '../packages/mcp-server/src/tools/inspect-source-compatibility';
import { compareTargetPaths } from '../packages/mcp-server/src/tools/compare-target-paths';
import { saveModernizationReport } from '../packages/mcp-server/src/tools/save-modernization-report';
import { openReportViewer } from '../packages/mcp-server/src/tools/open-report-viewer';
import type { Report } from '@modernization-navigator/shared';

async function main() {
  const repoRoot = '/Users/claudianapolitano/mn-targets/old-node-app';
  const targetNodeVersion = '20';

  console.log('Step 1: Discovering repository scope...');
  const scopeResult = await discoverRepoScope({ repoRoot, targetNodeVersion });
  console.log(JSON.stringify(scopeResult, null, 2));

  console.log('\nStep 2: Collecting runtime evidence...');
  const runtimeResult = await collectRuntimeEvidence({ repoRoot, targetNodeVersion });
  console.log(JSON.stringify(runtimeResult, null, 2));

  console.log('\nStep 3: Inspecting dependency blockers...');
  const blockersResult = await inspectDependencyBlockers({ repoRoot, targetNodeVersion });
  console.log(JSON.stringify(blockersResult, null, 2));

  console.log('\nStep 4: Inspecting ops runtime...');
  const opsResult = await inspectOpsRuntime({ repoRoot, targetNodeVersion });
  console.log(JSON.stringify(opsResult, null, 2));

  console.log('\nStep 5: Inspecting source compatibility...');
  const sourceResult = await inspectSourceCompatibility({ repoRoot, targetNodeVersion });
  console.log(JSON.stringify(sourceResult, null, 2));

  console.log('\nStep 6: Comparing target paths...');
  const pathsResult = await compareTargetPaths({ repoRoot, targetNodeVersion });
  console.log(JSON.stringify(pathsResult, null, 2));

  // Build the final report
  const report: Report = {
    reportId: `old-node-app-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    timestamp: new Date().toISOString(),
    repoRoot,
    targetNodeVersion,
    currentNodeVersion: '14.17.0',
    toolTrace: [
      scopeResult,
      runtimeResult,
      blockersResult,
      opsResult,
      sourceResult,
      pathsResult
    ],
    runtimeEvidence: runtimeResult.runtimeEvidence || [],
    issues: [
      ...(blockersResult.issues || []),
      ...(opsResult.issues || []),
      ...(sourceResult.issues || [])
    ],
    bobDecision: {
      recommendedPath: pathsResult.recommendedPath || 'staged',
      reasoning: 'Multiple critical blockers require staged migration',
      implementationOrder: [
        'Replace deprecated request package with axios or node-fetch',
        'Replace node-sass with sass (Dart Sass)',
        'Update express to v4.18+',
        'Update lodash to v4.17.21+',
        'Test on Node 16',
        'Update to Node 18',
        'Final migration to Node 20'
      ],
      validationChecklist: [
        'All dependencies compatible with Node 20',
        'CI pipeline updated',
        'Docker image updated',
        'All tests passing',
        'No deprecated API usage'
      ]
    }
  };

  console.log('\nStep 7: Saving modernization report...');
  const saveResult = await saveModernizationReport({ report });
  console.log(JSON.stringify(saveResult, null, 2));

  console.log('\nStep 8: Opening report viewer...');
  const viewerResult = await openReportViewer({
    reportPath: saveResult.latestPath,
    autoOpenViewer: true
  });
  console.log(JSON.stringify(viewerResult, null, 2));

  console.log('\n✅ Analysis complete!');
}

main().catch(console.error);

// Made with Bob
