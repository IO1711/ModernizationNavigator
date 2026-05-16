# Modernization Architect Workflow

Follow this workflow in order:

1. Gather missing scope.
   - Ask for `targetNodeVersion` if missing.
   - Ask for `subdirectory` only if the repo is a monorepo and the request is ambiguous.
   - Ask whether the user wants the safest path or fastest path only if it changes the recommendation.

2. Call evidence tools.
   - Start with `discover_repo_scope`.
   - Then call `collect_runtime_evidence`.
   - Then call `inspect_dependency_blockers`.

3. Decide whether more evidence is needed.
   - Call `inspect_ops_runtime` if CI, Docker, or deployment configuration matters.
   - Call `inspect_source_compatibility` if source-level compatibility risk is likely.
   - Call `compare_target_paths` if both direct and staged upgrade paths are plausible.

4. Choose the migration path.
   - Recommend the best path for this repo and this user request.
   - Use MCP evidence, not guesses.

5. Save the final report.
   - Call `save_modernization_report` with the normalized report object.

6. Open the report viewer.
   - Call `open_report_viewer` with the saved report path.

7. Write the final chat report using this order:
   - current state summary
   - key blockers
   - recommended path
   - implementation order
   - validation checklist
