# Multi-Framework Upgrade Plan

This document explains how to add support for React, Python frameworks, Spring, Flutter, and SwiftUI without breaking the current Bob-first Node.js behavior.

The key idea is simple:

1. Keep the current Node.js flow working exactly as it does now.
2. Add a parallel multi-framework path beside it.
3. Move Bob onto the broader path only after Node parity, viewer support, and tests are in place.

## Non-Negotiable Constraints

These must remain true throughout the upgrade:

1. Bob remains the decision maker.
2. MCP remains the deterministic evidence and artifact layer.
3. Existing Node MCP tools keep their current names and behavior until the new path is proven.
4. Existing saved reports and the current viewer continue to work.
5. The analyzed repository is never modified by this tool.
6. Local STDIO MCP remains the integration model.

## Current Node-Only Surfaces

The current implementation is strongly Node-specific in these places:

| Area | Current files | Current assumption |
| --- | --- | --- |
| Bob mode and workflow | `.bob/custom_modes.yaml`, `.bob/rules-modernization-architect/02-workflow.md` | Bob is a Node.js modernization architect and asks for `targetNodeVersion` |
| Shared report contract | `packages/shared/src/schemas/report.ts` | Report requires `requestedTargetNodeVersion`, `evaluatedTargetNodeVersions`, and Node-shaped runtime evidence |
| Shared tool input/output | `packages/shared/src/schemas/tool-results.ts` | Tool input uses `targetNodeVersion`; tool outputs are centered on Node upgrade analysis |
| Repo discovery | `packages/mcp-server/src/tools/discover-repo-scope.ts` | Project detection is driven by `package.json` |
| Runtime evidence | `packages/analysis-engine/src/detectors/runtime-evidence.ts` | Evidence means Node version pins, Docker Node images, and GitHub Actions Node setup |
| Dependency analysis | `packages/analysis-engine/src/detectors/dependency-blockers.ts` | Dependencies are npm packages and remote metadata comes from npm and OSV |
| Source analysis | `packages/analysis-engine/src/detectors/source-compatibility.ts` | Source risk is based on Node APIs and JS/TS module-system patterns |
| Viewer | `apps/viewer/app.js`, `apps/viewer/index.html` | UI labels say `Target Node`, `Evaluated`, and render Node-centric evidence |

## Delivery Strategy

Use a two-lane rollout.

- Lane 1: preserve the existing Node v1 path exactly as it is.
- Lane 2: add a new multi-framework v2 path in parallel.

This is the safest way to keep current behavior intact while expanding support.

## Recommended Framework Order

Ship the new frameworks in this order:

1. React
2. Python frameworks: FastAPI, Django, Flask
3. Spring
4. Flutter
5. SwiftUI

Why this order:

- React is the cheapest first win because it still lives in the Node ecosystem.
- Python and Spring add the biggest product value after React.
- Flutter introduces mobile and Dart constraints but still has good text-based project markers.
- SwiftUI should come last because Xcode project parsing and Apple build metadata are more specialized.

## Suggested New Structure

Add the new work in parallel instead of rewriting the current path in place.

```text
packages/
  shared/
    src/
      schemas/
        stack-profile.ts
        report-v2.ts
        tool-results-v2.ts
        manifest-v2.ts
      types/
        report-v2.ts
        tools-v2.ts

  analysis-engine/
    src/
      frameworks/
        framework-adapter.ts
        registry.ts
        detection/
          project-descriptor.ts
        node/
          node-adapter.ts
        react/
          react-adapter.ts
        python/
          python-adapter.ts
        spring/
          spring-adapter.ts
        flutter/
          flutter-adapter.ts
        swiftui/
          swiftui-adapter.ts

  providers/
    src/
      pypi-provider.ts
      maven-central-provider.ts
      pubdev-provider.ts

  knowledge-base/
    data/
      ecosystems/
        node/
        python/
        spring/
        flutter/
        swiftui/

  mcp-server/
    src/
      tools-v2/
        discover-project-stack.ts
        collect-environment-evidence.ts
        inspect-framework-dependencies.ts
        inspect-platform-config.ts
        inspect-source-risks.ts
        compare-upgrade-paths.ts
        save-modernization-report-v2.ts
```

## Step-by-Step Implementation Plan

## Step 1: Freeze the Current v1 Behavior

Goal:
Create a safety net before adding any new abstraction.

Where:

- `tests/contracts/*`
- `apps/viewer/sample/reports/sample-report.json`
- `reports/latest/report.json`
- `reports/history/*`

What to add:

1. Backward-compatibility tests for the current report schema.
2. Tool registry tests that confirm the current v1 tool names stay available.
3. Viewer smoke coverage for a v1 Node report.
4. Snapshot coverage for the current sample report shape.

How:

- Treat the existing Node report contract as `v1`.
- Do not weaken current assertions yet.
- Use these tests as the guardrail for every later step.

Exit criteria:

- A Node report produced today still validates and renders exactly as before after every future change.

## Step 2: Add Parallel v2 Shared Contracts

Goal:
Introduce a generic cross-framework schema without changing the existing v1 schema.

Where:

- Add `packages/shared/src/schemas/stack-profile.ts`
- Add `packages/shared/src/schemas/report-v2.ts`
- Add `packages/shared/src/schemas/tool-results-v2.ts`
- Add `packages/shared/src/schemas/manifest-v2.ts`
- Add matching `types/` files
- Update `packages/shared/src/index.ts` to export the new contracts

What to model in v2:

- `ecosystem`
- `framework`
- `language`
- `runtimeName`
- `requestedTargetVersion`
- `evaluatedTargetVersions`
- `dependencyManager`
- `buildSystem`
- `environmentEvidence`
- `projectDescriptors`

How:

- Keep `packages/shared/src/schemas/report.ts` unchanged.
- Keep `packages/shared/src/schemas/tool-results.ts` unchanged.
- Keep `packages/shared/src/schemas/manifest.ts` unchanged.
- Add new v2 contracts beside them, not inside them.
- Reuse the existing `bobDecision`, `bobExecutionPlan`, and `validationChecklist` shapes so Bob's final decision structure stays familiar.

Important rule:

Do not try to force Python, Spring, Flutter, or SwiftUI into `requestedTargetNodeVersion`. That would preserve file names but damage the meaning of the data.

Exit criteria:

- The repo contains both a stable Node v1 contract and a generic v2 contract.

## Step 3: Add Parallel v2 MCP Tool Names and Registries

Goal:
Create a new generic tool path without disturbing the current Node toolset.

Where:

- Add `packages/shared/src/constants/tool-names-v2.ts`
- Add `packages/mcp-server/src/tools-v2/*`
- Update `packages/mcp-server/src/index.ts`

What to add:

1. `discover_project_stack`
2. `collect_environment_evidence`
3. `inspect_framework_dependencies`
4. `inspect_platform_config`
5. `inspect_source_risks`
6. `compare_upgrade_paths`
7. `save_modernization_report_v2`

How:

- Keep the current v1 tools registered and unchanged.
- Register the v2 tools in parallel.
- Let Bob decide which tool family to use.
- Do not rename or remove:
  - `discover_repo_scope`
  - `collect_runtime_evidence`
  - `inspect_dependency_blockers`
  - `inspect_ops_runtime`
  - `inspect_source_compatibility`
  - `compare_target_paths`
  - `save_modernization_report`
  - `open_report_viewer`

Exit criteria:

- The MCP server can expose both v1 Node tools and v2 generic tools at the same time.

## Step 4: Build a Framework Adapter Layer Around the Existing Analysis Engine

Goal:
Create one internal abstraction that every framework can plug into.

Where:

- Add `packages/analysis-engine/src/frameworks/framework-adapter.ts`
- Add `packages/analysis-engine/src/frameworks/registry.ts`
- Add `packages/analysis-engine/src/frameworks/detection/project-descriptor.ts`
- Add `packages/analysis-engine/src/frameworks/node/node-adapter.ts`

What the adapter should do:

1. Detect whether a project matches the framework.
2. Collect environment evidence.
3. Inspect dependency risk.
4. Inspect platform and deployment configuration.
5. Inspect source compatibility risk.
6. Propose upgrade target comparisons.

How:

- The first adapter should be a Node adapter.
- That Node adapter should wrap the current detector functions instead of rewriting them.
- Reuse:
  - `detectPackageManager`
  - `collectRuntimeEvidenceEntries`
  - `inspectDependencyBlockers`
  - `inspectOpsRuntime`
  - `inspectSourceCompatibility`
  - `compareTargetPaths`

Why this matters:

- It proves the new architecture while preserving the old logic.
- It keeps the current Node implementation as the source of truth until the new generic lane is proven.

Exit criteria:

- The v2 tool path can analyze a Node project by delegating to a Node adapter that still uses the current detector logic.

## Step 5: Expand Discovery Beyond `package.json`

Goal:
Teach the system how to identify project stacks before framework-specific analysis begins.

Where:

- New v2 discovery logic in `packages/mcp-server/src/tools-v2/discover-project-stack.ts`
- Shared detection helpers in `packages/analysis-engine/src/frameworks/detection/*`
- Keep `packages/mcp-server/src/tools/discover-repo-scope.ts` unchanged

What to detect:

- React:
  - `package.json`
  - `react`, `react-dom`, `next`, `vite`, `react-scripts`
- Python:
  - `pyproject.toml`
  - `requirements.txt`
  - `requirements-dev.txt`
  - `Pipfile`
  - `poetry.lock`
  - `uv.lock`
  - imports of `fastapi`, `django`, `flask`
- Spring:
  - `pom.xml`
  - `build.gradle`
  - `build.gradle.kts`
  - `gradle.properties`
  - Spring Boot dependencies or plugins
- Flutter:
  - `pubspec.yaml`
  - `lib/main.dart`
  - `android/`
  - `ios/`
- SwiftUI:
  - `.xcodeproj/project.pbxproj`
  - `Package.swift`
  - `*.swift` files importing `SwiftUI`
  - `Info.plist`

How:

- Return structured `projectDescriptors` instead of a single Node guess.
- Include `confidence`, `markers`, and `rootPath` in each descriptor.
- Allow multiple descriptors in monorepos.

Exit criteria:

- The v2 discovery tool can classify candidate projects without relying on `package.json` alone.

## Step 6: Generalize the Knowledge Base and Provider Layer

Goal:
Support framework-specific compatibility rules and external metadata without mixing everything into Node files.

Where:

- `packages/knowledge-base/data/ecosystems/*`
- `packages/knowledge-base/src/*`
- `packages/providers/src/*`

What to add:

1. Per-ecosystem rule files.
2. Per-ecosystem loader functions.
3. New provider implementations:
   - `pypi-provider.ts`
   - `maven-central-provider.ts`
   - `pubdev-provider.ts`

How:

- Keep `npm-registry-provider.ts` exactly as the Node path uses it today.
- Reuse `osv-provider.ts` where the target ecosystem is supported by OSV:
  - `npm`
  - `PyPI`
  - `Maven`
  - `Pub`
- Defer a remote SwiftUI-specific package provider until local project parsing is solid.

Exit criteria:

- Each new framework has a place for deterministic compatibility rules and, where appropriate, remote package metadata.

## Step 7: Add React Support First

Goal:
Ship the first non-plain-Node framework with the smallest amount of architectural risk.

Where:

- `packages/analysis-engine/src/frameworks/react/react-adapter.ts`
- `packages/knowledge-base/data/ecosystems/node/react-rules.json`
- Optional React-focused helpers under `packages/analysis-engine/src/frameworks/react/*`

What React support should do:

1. Detect React-based projects.
2. Reuse Node runtime and dependency analysis.
3. Add React-specific findings, such as:
   - outdated `react-scripts`
   - major React version mismatches
   - build-tool drift around Vite, Webpack, or Next.js
   - SSR or routing framework markers when useful

How:

- Model React as:
  - `ecosystem = node`
  - `framework = react`
- Keep React support layered on top of Node, not separate from it.
- Keep the current v1 Node tool path usable for React repos even before the new viewer ships.

Exit criteria:

- React repos receive richer classification and framework findings, while the current Node behavior still works unchanged.

## Step 8: Upgrade the Viewer and Report Writer to Dual-Mode

Goal:
Render both old Node reports and new cross-framework reports without breaking the current UI.

Where:

- `apps/viewer/app.js`
- `apps/viewer/index.html`
- `apps/viewer/sample/reports/*`
- `packages/mcp-server/src/report-writer.ts`
- `packages/mcp-server/src/tools/save-modernization-report.ts`
- `packages/mcp-server/src/tools-v2/save-modernization-report-v2.ts`

How:

- Detect report version at load time.
- If the report is v1:
  - keep today's labels and rendering behavior
- If the report is v2:
  - use generic labels such as:
    - `Target runtime`
    - `Target version`
    - `Framework`
    - `Dependency manager`
    - `Environment evidence`

Important compatibility rules:

1. Keep existing DOM ids if possible.
2. Keep old sample reports loading.
3. Do not force the viewer to become v2-only.

Why this step comes before Python, Spring, Flutter, and SwiftUI:

- Those ecosystems cannot be represented honestly in the current Node-shaped viewer.

Exit criteria:

- The viewer can load either a v1 Node report or a v2 multi-framework report.

## Step 9: Add Python Framework Support

Goal:
Support FastAPI, Django, and Flask as the first non-Node server-side ecosystems.

Where:

- `packages/analysis-engine/src/frameworks/python/python-adapter.ts`
- Python detection helpers under `packages/analysis-engine/src/frameworks/python/*`
- `packages/knowledge-base/data/ecosystems/python/*`
- `packages/providers/src/pypi-provider.ts`

What to detect:

- Project metadata:
  - `pyproject.toml`
  - `requirements*.txt`
  - `Pipfile`
  - `poetry.lock`
  - `uv.lock`
- Framework markers:
  - `fastapi`
  - `django`
  - `flask`
- Runtime markers:
  - `requires-python`
  - `.python-version`
  - `runtime.txt`
  - Docker base images
  - GitHub Actions `setup-python`

What findings to support first:

1. Python runtime drift.
2. Framework version compatibility.
3. Deployment and ASGI/WSGI config drift.
4. Dependency vulnerability and deprecation checks.

How:

- Start with text-first parsing instead of full Python AST analysis.
- Infer validation commands from the project manager when possible:
  - `pytest`
  - `poetry run pytest`
  - `uv run pytest`

Exit criteria:

- Bob can analyze a Python project with deterministic runtime, dependency, and deployment evidence and save a v2 report.

## Step 10: Add Spring Support

Goal:
Support Java and Spring Boot modernization with a strong focus on runtime and build compatibility first.

Where:

- `packages/analysis-engine/src/frameworks/spring/spring-adapter.ts`
- `packages/knowledge-base/data/ecosystems/spring/*`
- `packages/providers/src/maven-central-provider.ts`

What to detect:

- `pom.xml`
- `build.gradle`
- `build.gradle.kts`
- Spring Boot plugin and dependency versions
- Java toolchain and compiler settings
- Docker Java base images
- GitHub Actions `setup-java`

What findings to support first:

1. Java runtime target drift.
2. Spring Boot version compatibility.
3. Build plugin compatibility.
4. Deployment config mismatches.

How:

- Start with Maven and Gradle parsing plus dependency metadata.
- Delay deep Java source compatibility analysis until runtime and dependency analysis are stable.
- Recommend validation commands based on the build tool:
  - `./mvnw test`
  - `./gradlew test`

Exit criteria:

- Spring projects get structured build, runtime, and dependency findings in the v2 path.

## Step 11: Add Flutter Support

Goal:
Support Flutter projects with a strong configuration and SDK-compatibility pass first.

Where:

- `packages/analysis-engine/src/frameworks/flutter/flutter-adapter.ts`
- `packages/knowledge-base/data/ecosystems/flutter/*`
- `packages/providers/src/pubdev-provider.ts`

What to detect:

- `pubspec.yaml`
- Dart SDK constraints
- Flutter SDK pinning
- Android Gradle config
- iOS Podfile and deployment settings
- GitHub Actions, Codemagic, or Fastlane pipeline config

What findings to support first:

1. Dart SDK constraint mismatches.
2. Flutter SDK drift.
3. Android and iOS deployment target mismatches.
4. Dependency issues from `pubspec.yaml`.

How:

- Start with config and dependency analysis.
- Keep source scanning lightweight at first.
- Use `pub` and OSV ecosystem data where available.

Exit criteria:

- Flutter projects can be classified, inspected, and reported through the v2 flow without viewer special cases.

## Step 12: Add SwiftUI Support Last

Goal:
Support SwiftUI with a conservative first release focused on local project evidence.

Where:

- `packages/analysis-engine/src/frameworks/swiftui/swiftui-adapter.ts`
- `packages/knowledge-base/data/ecosystems/swiftui/*`

What to detect:

- `.xcodeproj/project.pbxproj`
- `Package.swift`
- `*.swift` files importing `SwiftUI`
- `Info.plist`
- Fastlane, GitHub Actions, or Xcode Cloud config

What findings to support first:

1. iOS deployment target drift.
2. Swift tools version drift.
3. Xcode project build setting mismatches.
4. Basic package dependency compatibility where available locally.

How:

- Start local-only.
- Do not block SwiftUI support on a remote package provider.
- Treat remote package intelligence as a later enhancement.

Why it is last:

- Apple project metadata is more specialized than the text-based configs in the earlier frameworks.

Exit criteria:

- SwiftUI repos can be discovered and analyzed with a useful first pass, even if remote dependency intelligence comes later.

## Step 13: Update Bob's Mode Only After the v2 Path Is Real

Goal:
Expand Bob's instructions after the underlying tools, viewer, and contracts are ready.

Where:

- `.bob/custom_modes.yaml`
- `.bob/rules-modernization-architect/01-role.md`
- `.bob/rules-modernization-architect/02-workflow.md`

What to change:

1. Update Bob's role from Node-only to multi-framework modernization.
2. Teach Bob to start with `discover_project_stack` in the v2 path.
3. Keep a fallback rule:
   - if the repo is a plain Node runtime-upgrade case, Bob may still use v1 tools
4. Keep Bob responsible for:
   - asking scope questions
   - choosing which tool family to call
   - comparing upgrade paths
   - selecting the final recommendation
   - writing the final chat report

Why this is last:

- Bob should not be told to use a broader workflow until the underlying multi-framework tools really exist.

Exit criteria:

- Bob can choose between the stable Node lane and the new multi-framework lane without ambiguity.

## Definition of Done for Each Framework

A framework addition is complete only when all of the following are true:

1. Discovery identifies the ecosystem and framework with a useful confidence signal.
2. Bob receives deterministic evidence about runtime, dependencies, and platform config.
3. The tool can generate structured issues and validation steps.
4. The report can be saved and rendered in the viewer.
5. Existing Node v1 reports still validate and render after the new work lands.

## Things Not To Do

Avoid these shortcuts:

1. Do not rename the current Node tools early.
2. Do not replace the v1 report schema with generic fields in one shot.
3. Do not overload `targetNodeVersion` to mean Python, Java, Dart, or iOS targets.
4. Do not make the viewer v2-only.
5. Do not rewrite the current Node detectors before the adapter layer exists.

## First Implementation Slice

If the team wants the safest first milestone, do only this first:

1. Step 1: freeze v1 behavior.
2. Step 2: add parallel v2 shared contracts.
3. Step 3: add parallel v2 MCP tool names.
4. Step 4: build the Node adapter shim.
5. Step 7: add React support.

That sequence proves the architecture with the least risk and keeps the current tool fully intact while the broader framework work starts.
