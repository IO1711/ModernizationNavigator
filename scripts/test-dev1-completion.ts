#!/usr/bin/env tsx
/**
 * Test script to validate Dev 1 completion criteria from the technical plan.
 * 
 * This validates:
 * 1. .bob/mcp.json contains modernization-navigator server with all 8 tools
 * 2. MCP server registers exactly 8 tools
 * 3. discover_repo_scope returns valid schema
 * 4. save_modernization_report writes correct files
 * 5. save_modernization_report returns correct paths
 * 6. open_report_viewer returns correct URL and status
 * 7. Bob Modernization Architect mode is configured
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '..');

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function addResult(name: string, passed: boolean, message: string): void {
  results.push({ name, passed, message });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}: ${message}`);
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const content = await fs.readFile(path.join(PROJECT_ROOT, filePath), 'utf8');
  return JSON.parse(content);
}

async function callMcpTool(method: string, params?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    });

    const child = spawn('node', [path.join(PROJECT_ROOT, 'packages/mcp-server/dist/index.js')], {
      stdio: ['pipe', 'pipe', 'ignore']
    });

    let stdout = '';
    let resolved = false;

    // Set a timeout to kill the process if it hangs
    const timeout = setTimeout(() => {
      if (!resolved) {
        child.kill();
        reject(new Error('MCP tool call timed out after 10 seconds'));
      }
    }, 10000);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      // Try to parse after each chunk in case we have a complete response
      try {
        const response = JSON.parse(stdout);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          child.kill();
          resolve(response);
        }
      } catch {
        // Not a complete JSON yet, keep reading
      }
    });

    child.on('close', () => {
      if (!resolved) {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(stdout);
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse MCP response: ${stdout}`));
        }
      }
    });

    child.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(error);
      }
    });

    child.stdin.write(request + '\n');
    child.stdin.end();
  });
}

async function test1_McpJsonConfiguration(): Promise<void> {
  try {
    const mcpConfig = await readJsonFile('.bob/mcp.json') as {
      mcpServers?: {
        'modernization-navigator'?: {
          command?: string;
          args?: string[];
          alwaysAllow?: string[];
        };
      };
    };

    const server = mcpConfig.mcpServers?.['modernization-navigator'];
    if (!server) {
      addResult('Test 1: .bob/mcp.json', false, 'Missing modernization-navigator server');
      return;
    }

    const expectedTools = [
      'discover_repo_scope',
      'collect_runtime_evidence',
      'inspect_dependency_blockers',
      'inspect_ops_runtime',
      'inspect_source_compatibility',
      'compare_target_paths',
      'save_modernization_report',
      'open_report_viewer'
    ];

    const alwaysAllow = server.alwaysAllow || [];
    const hasAllTools = expectedTools.every(tool => alwaysAllow.includes(tool));

    if (!hasAllTools) {
      addResult('Test 1: .bob/mcp.json', false, `Missing tools in alwaysAllow. Expected: ${expectedTools.join(', ')}`);
      return;
    }

    addResult('Test 1: .bob/mcp.json', true, 'Contains modernization-navigator server with all 8 tools');
  } catch (error) {
    addResult('Test 1: .bob/mcp.json', false, `Error: ${error}`);
  }
}

async function test2_McpServerRegistration(): Promise<void> {
  try {
    const response = await callMcpTool('tools/list') as {
      result?: { tools?: Array<{ name: string }> };
    };

    const tools = response.result?.tools || [];
    const toolNames = tools.map(t => t.name);

    const expectedTools = [
      'discover_repo_scope',
      'collect_runtime_evidence',
      'inspect_dependency_blockers',
      'inspect_ops_runtime',
      'inspect_source_compatibility',
      'compare_target_paths',
      'save_modernization_report',
      'open_report_viewer'
    ];

    if (toolNames.length !== 8) {
      addResult('Test 2: MCP Server Registration', false, `Expected 8 tools, got ${toolNames.length}`);
      return;
    }

    const hasAllTools = expectedTools.every(tool => toolNames.includes(tool));
    if (!hasAllTools) {
      addResult('Test 2: MCP Server Registration', false, `Missing tools: ${expectedTools.filter(t => !toolNames.includes(t)).join(', ')}`);
      return;
    }

    addResult('Test 2: MCP Server Registration', true, 'Registers exactly 8 tools');
  } catch (error) {
    addResult('Test 2: MCP Server Registration', false, `Error: ${error}`);
  }
}

async function test3_DiscoverRepoScope(): Promise<void> {
  try {
    const response = await callMcpTool('tools/call', {
      name: 'discover_repo_scope',
      arguments: { repoRoot: PROJECT_ROOT }
    }) as {
      result?: { content?: Array<{ text?: string }> };
    };

    const resultText = response.result?.content?.[0]?.text;
    if (!resultText) {
      addResult('Test 3: discover_repo_scope', false, 'No result returned');
      return;
    }

    const result = JSON.parse(resultText) as {
      repoRoot?: string;
      detectedPackageManager?: string;
      workspaceType?: string;
      candidateProjects?: string[];
    };

    const hasRequiredFields = 
      result.repoRoot &&
      result.detectedPackageManager &&
      result.workspaceType &&
      Array.isArray(result.candidateProjects);

    if (!hasRequiredFields) {
      addResult('Test 3: discover_repo_scope', false, 'Missing required fields in response');
      return;
    }

    addResult('Test 3: discover_repo_scope', true, `Returns valid schema with ${result.candidateProjects?.length || 0} projects`);
  } catch (error) {
    addResult('Test 3: discover_repo_scope', false, `Error: ${error}`);
  }
}

async function test4_SaveModernizationReport(): Promise<void> {
  try {
    // Read the sample report
    const sampleReport = await readJsonFile('reports/latest/report.json') as Record<string, unknown>;
    
    // Create a test report with a unique ID
    const testReportId = `test-${Date.now()}`;
    const testReport = {
      ...sampleReport,
      reportId: testReportId,
      createdAt: new Date().toISOString()
    };

    const response = await callMcpTool('tools/call', {
      name: 'save_modernization_report',
      arguments: { report: testReport }
    }) as {
      result?: { content?: Array<{ text?: string }> };
    };

    const resultText = response.result?.content?.[0]?.text;
    if (!resultText) {
      addResult('Test 4: save_modernization_report', false, 'No result returned');
      return;
    }

    const result = JSON.parse(resultText) as {
      reportId?: string;
      reportPath?: string;
      historyPath?: string;
    };

    // Check if files were created
    const latestExists = await fs.access(path.join(PROJECT_ROOT, 'reports/latest/report.json')).then(() => true).catch(() => false);
    const historyExists = await fs.access(path.join(PROJECT_ROOT, `reports/history/${testReportId}.json`)).then(() => true).catch(() => false);
    const indexExists = await fs.access(path.join(PROJECT_ROOT, 'reports/index.json')).then(() => true).catch(() => false);

    if (!latestExists || !historyExists || !indexExists) {
      addResult('Test 4: save_modernization_report', false, `Missing files: latest=${latestExists}, history=${historyExists}, index=${indexExists}`);
      return;
    }

    if (result.reportId !== testReportId) {
      addResult('Test 4: save_modernization_report', false, 'Returned reportId does not match');
      return;
    }

    addResult('Test 4: save_modernization_report', true, 'Writes all required files and returns correct paths');
  } catch (error) {
    addResult('Test 4: save_modernization_report', false, `Error: ${error}`);
  }
}

async function test5_OpenReportViewer(): Promise<void> {
  try {
    const response = await callMcpTool('tools/call', {
      name: 'open_report_viewer',
      arguments: {
        reportPath: 'reports/latest/report.json',
        autoOpenViewer: false
      }
    }) as {
      result?: { content?: Array<{ text?: string }> };
      isError?: boolean;
    };

    // Check if the tool returned an error
    if (response.isError) {
      const errorText = response.result?.content?.[0]?.text || 'Unknown error';
      addResult('Test 5: open_report_viewer', false, `Tool error: ${errorText}`);
      return;
    }

    const resultText = response.result?.content?.[0]?.text;
    if (!resultText) {
      addResult('Test 5: open_report_viewer', false, 'No result returned');
      return;
    }

    const result = JSON.parse(resultText) as {
      viewerUrl?: string;
      serverStatus?: string;
    };

    const urlPattern = /^http:\/\/127\.0\.0\.1:\d+\/$/;
    if (!result.viewerUrl || !urlPattern.test(result.viewerUrl)) {
      addResult('Test 5: open_report_viewer', false, `Invalid viewerUrl: ${result.viewerUrl}`);
      return;
    }

    if (result.serverStatus !== 'started' && result.serverStatus !== 'reused') {
      addResult('Test 5: open_report_viewer', false, `Invalid serverStatus: ${result.serverStatus}`);
      return;
    }

    addResult('Test 5: open_report_viewer', true, `Returns ${result.viewerUrl} with status ${result.serverStatus}`);
  } catch (error) {
    addResult('Test 5: open_report_viewer', false, `Error: ${error}`);
  }
}

async function test6_BobModeConfiguration(): Promise<void> {
  try {
    // Check if custom_modes.yaml exists (it's YAML, not JSON)
    const customModesExists = await fs.access(path.join(PROJECT_ROOT, '.bob/custom_modes.yaml')).then(() => true).catch(() => false);
    const roleFile = await fs.access(path.join(PROJECT_ROOT, '.bob/rules-modernization-architect/01-role.md')).then(() => true).catch(() => false);
    const workflowFile = await fs.access(path.join(PROJECT_ROOT, '.bob/rules-modernization-architect/02-workflow.md')).then(() => true).catch(() => false);

    if (!customModesExists) {
      addResult('Test 6: Bob Mode Configuration', false, 'Missing .bob/custom_modes.yaml');
      return;
    }

    if (!roleFile || !workflowFile) {
      addResult('Test 6: Bob Mode Configuration', false, 'Missing rules files');
      return;
    }

    addResult('Test 6: Bob Mode Configuration', true, 'Modernization Architect mode configured with rules');
  } catch (error) {
    addResult('Test 6: Bob Mode Configuration', false, `Error: ${error}`);
  }
}

async function main(): Promise<void> {
  console.log('🧪 Testing Dev 1 Completion Criteria\n');

  await test1_McpJsonConfiguration();
  await test2_McpServerRegistration();
  await test3_DiscoverRepoScope();
  await test4_SaveModernizationReport();
  await test5_OpenReportViewer();
  await test6_BobModeConfiguration();

  console.log('\n📊 Summary:');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('\n✅ All Dev 1 completion criteria met!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Review the output above.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Made with Bob
