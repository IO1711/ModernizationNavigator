# Modernization Architect Workflow

Follow this workflow in order:

1. Discover the current stack first.
   - Start with `discover_project_stack` before asking version-specific questions.
   - Use the returned framework, language, runtime name, and project descriptors to understand what kind of upgrade the user might mean.
   - If discovery finds multiple plausible project descriptors, ask whether to analyze the whole repo or one subproject.

2. Gather missing scope after discovery.
   - If the request is generic and the detected framework is React, ask whether the user wants a Node runtime upgrade, a React/framework/tooling upgrade, or both.
   - If the request is a plain Node runtime-upgrade case and the target is missing, ask for `targetNodeVersion`.
   - Ask for `subdirectory` only if discovery still leaves scope ambiguous.
   - Ask whether the user wants the safest path or fastest path only if it changes the recommendation.

3. Choose the tool family.
   - Use the v1 Node tool family for plain Node runtime-upgrade cases when that is sufficient.
   - Use the v2 stack-aware tool family when framework-aware analysis matters.

4. Call evidence tools.
   - v1 Node lane:
     - Start with `discover_repo_scope`.
     - Then call `collect_runtime_evidence`.
     - Then call `inspect_dependency_blockers`.
   - v2 stack-aware lane:
     - Start with `collect_environment_evidence`.
     - Then call `inspect_framework_dependencies`.

5. Decide whether more evidence is needed.
   - v1 Node lane:
     - Call `inspect_ops_runtime` if CI, Docker, or deployment configuration matters.
     - Call `inspect_source_compatibility` if source-level compatibility risk is likely.
     - Call `compare_target_paths` if both direct and staged upgrade paths are plausible.
   - v2 stack-aware lane:
     - Call `inspect_platform_config` if CI, Docker, deployment, or platform configuration matters.
     - Call `inspect_source_risks` if source-level compatibility risk is likely.
     - Call `compare_upgrade_paths` if both direct and staged upgrade paths are plausible.

6. Choose the migration path.
   - Recommend the best path for this repo and this user request.
   - Use MCP evidence, not guesses.

7. Save the final report.
   - Use `save_modernization_report` for the v1 Node lane.
   - Use `save_modernization_report_v2` for the v2 stack-aware lane.

8. Open the report viewer.
   - Call `open_report_viewer` for saved v1 reports and include `repoRoot` when available.
   - Call `open_report_viewer` for saved v2 reports after saving them and include `repoRoot` when available.

9. Write the final chat report using this order:
   - current state summary
   - key blockers
   - recommended path
   - implementation order
   - validation checklist
