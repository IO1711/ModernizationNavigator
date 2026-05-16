/*
  Viewer app logic. Two responsibilities:
  1. Render a saved report into the DOM contract documented in
     index.html (see technical_plan.md §14.1 and §16 for the source
     of truth on required ids).
  2. Provide tab navigation between the section panels without
     unmounting any of the contract elements — tabs use the `hidden`
     attribute so every required id stays in the DOM at all times.
  No framework. No build step. Plain HTML/CSS/JS per §2 rule 8.
*/

const defaultConfig = {
  sampleMode: false,
  manifestPath: '/reports/index.json',
  sampleManifestPath: '/sample/index.json'
};

const config = {
  ...defaultConfig,
  ...(window.__VIEWER_CONFIG__ || {})
};

const elements = {
  historySelect: document.getElementById('history-select'),
  reportMeta: document.getElementById('report-meta'),
  decisionTitle: document.getElementById('decision-title'),
  decisionSummary: document.getElementById('decision-summary'),
  decisionPills: document.getElementById('decision-pills'),
  decisionRationale: document.getElementById('decision-rationale'),
  decisionExtras: document.getElementById('decision-extras'),
  targetPaths: document.getElementById('target-paths'),
  issues: document.getElementById('issues'),
  evidence: document.getElementById('evidence'),
  executionPlan: document.getElementById('execution-plan'),
  validationChecklist: document.getElementById('validation-checklist'),
  toolTrace: document.getElementById('tool-trace'),
  stats: document.getElementById('stats')
};

const TABS = ['overview', 'issues', 'evidence', 'plan', 'validation', 'trace'];

// ----- URL + fetch helpers ---------------------------------------------------

function resolveAgainst(baseUrl, relativePath) {
  // Manifest path conventions in this project:
  //   "./reports/foo.json" — relative to the manifest URL (demo sample)
  //   "reports/latest/foo.json" — project-root-relative (MCP writer)
  if (relativePath.startsWith('./') || relativePath.startsWith('../')) {
    return new URL(relativePath, baseUrl).toString();
  }
  const origin = new URL(baseUrl).origin;
  const absolute = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return new URL(absolute, origin).toString();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return response.json();
}

// ----- DOM helpers -----------------------------------------------------------

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content === undefined || content === null) return node;
  if (Array.isArray(content)) node.append(...content.filter(Boolean));
  else if (content instanceof Node) node.append(content);
  else node.textContent = String(content);
  return node;
}

function clearElement(element) {
  element.replaceChildren();
}

function createEmptyState(message) {
  return el('div', 'empty', message);
}

function bulletList(items) {
  const ul = el('ul', 'bullet-list');
  for (const item of items) ul.append(el('li', null, item));
  return ul;
}

function codeBlock(commands) {
  if (!commands || commands.length === 0) return null;
  return el('pre', 'code-block', commands.map((c) => `$ ${c}`).join('\n'));
}

function tag(text, variant) {
  return el('span', variant ? `tag ${variant}` : 'tag', text);
}

function formatDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return '';
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

// ----- Tabs ------------------------------------------------------------------

function setupTabs() {
  const links = document.querySelectorAll('.rail-link[data-tab]');
  const panels = document.querySelectorAll('.panel[data-panel]');

  function activate(name) {
    const target = TABS.includes(name) ? name : 'overview';
    for (const link of links) {
      link.classList.toggle('active', link.dataset.tab === target);
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.panel !== target;
    }
    if (location.hash !== `#${target}`) {
      history.replaceState(null, '', `#${target}`);
    }
  }

  for (const link of links) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      activate(link.dataset.tab);
    });
  }

  window.addEventListener('hashchange', () => {
    activate((location.hash || '#overview').slice(1));
  });

  const initial = (location.hash || '#overview').slice(1);
  activate(initial);
}

function updateRailCounts(report) {
  const counts = {
    issues: (report.issues || []).length,
    evidence: (report.runtimeEvidence || []).length,
    plan: (report.bobExecutionPlan || []).length,
    validation: (report.validationChecklist || []).length,
    trace: (report.toolTrace || []).length
  };
  for (const [key, count] of Object.entries(counts)) {
    const badge = document.querySelector(`.rail-badge[data-count="${key}"]`);
    if (!badge) continue;
    badge.textContent = String(count);
    badge.classList.toggle('zero', count === 0);
  }
}

// ----- Renderers -------------------------------------------------------------

function renderStats(report) {
  if (!elements.stats) return;
  clearElement(elements.stats);
  const stats = [
    {
      label: 'Target Node',
      value: report.requestedTargetNodeVersion || '—',
      foot:
        (report.evaluatedTargetNodeVersions || []).length
          ? `Evaluated: ${report.evaluatedTargetNodeVersions.join(', ')}`
          : null
    },
    {
      label: 'Issues',
      value: (report.issues || []).length,
      foot: (report.issues || []).length === 0 ? 'No blockers detected' : 'See Issues tab'
    },
    {
      label: 'Evidence',
      value: (report.runtimeEvidence || []).length,
      foot: 'Runtime declarations'
    },
    {
      label: 'Plan steps',
      value: (report.bobExecutionPlan || []).length,
      foot: 'Recommended rollout order'
    },
    {
      label: 'Tool calls',
      value: (report.toolTrace || []).length,
      foot: traceSummary(report.toolTrace || [])
    }
  ];
  for (const stat of stats) {
    const card = el('div', 'stat');
    card.append(el('div', 'stat-label', stat.label));
    card.append(el('div', 'stat-value', String(stat.value)));
    if (stat.foot) card.append(el('div', 'stat-foot', stat.foot));
    elements.stats.append(card);
  }
}

function traceSummary(trace) {
  if (!trace.length) return null;
  const ok = trace.filter((t) => t.status === 'success').length;
  return `${ok}/${trace.length} succeeded`;
}

function renderMeta(report) {
  clearElement(elements.reportMeta);
  const rows = [
    ['Report ID', report.reportId, true],
    ['Created', formatDate(report.createdAt), false],
    ['Repo', report.repoRoot, true],
    ['Subdirectory', report.subdirectory || '—', true],
    ['Target Node', report.requestedTargetNodeVersion, false],
    ['Evaluated', (report.evaluatedTargetNodeVersions || []).join(', ') || '—', false],
    ['Package manager', report.detectedPackageManager, false],
    ['Offline mode', report.offlineMode ? 'Yes' : 'No', false]
  ];
  for (const [label, value, mono] of rows) {
    elements.reportMeta.append(el('dt', null, label));
    elements.reportMeta.append(el('dd', mono ? 'mono' : null, value || '—'));
  }
}

function renderDecision(report) {
  const decision = report.bobDecision || {};
  elements.decisionTitle.textContent = decision.selectedTargetPath || '—';
  elements.decisionSummary.textContent = decision.summary || '';

  clearElement(elements.decisionPills);
  const pills = [];
  if (report.requestedTargetNodeVersion) {
    pills.push({ text: `Requested · Node ${report.requestedTargetNodeVersion}`, strong: true });
  }
  if (report.evaluatedTargetNodeVersions?.length) {
    pills.push({ text: `Evaluated · ${report.evaluatedTargetNodeVersions.join(', ')}` });
  }
  if (report.detectedPackageManager) {
    pills.push({ text: report.detectedPackageManager });
  }
  if (typeof report.offlineMode === 'boolean') {
    pills.push({ text: report.offlineMode ? 'Offline' : 'Online' });
  }
  for (const p of pills) {
    elements.decisionPills.append(el('span', p.strong ? 'pill pill-strong' : 'pill', p.text));
  }

  if (decision.rationale) {
    elements.decisionRationale.hidden = false;
    elements.decisionRationale.querySelector('.rationale').textContent = decision.rationale;
  } else {
    elements.decisionRationale.hidden = true;
  }

  const blocks = {
    risks: decision.prioritizedRisks || [],
    solutions: decision.chosenSolutions || [],
    tradeoffs: decision.tradeoffs || []
  };
  const anyShown = Object.values(blocks).some((arr) => arr.length > 0);
  elements.decisionExtras.hidden = !anyShown;
  for (const [key, items] of Object.entries(blocks)) {
    const block = elements.decisionExtras.querySelector(`[data-block="${key}"]`);
    const ul = block.querySelector('ul');
    clearElement(ul);
    if (items.length === 0) {
      block.hidden = true;
    } else {
      block.hidden = false;
      for (const item of items) ul.append(el('li', null, item));
    }
  }
}

function renderTargetPaths(report) {
  clearElement(elements.targetPaths);
  const versions = report.evaluatedTargetNodeVersions || [];
  if (versions.length === 0) {
    elements.targetPaths.append(createEmptyState('No target paths evaluated.'));
    return;
  }
  const requested = String(report.requestedTargetNodeVersion ?? '');
  for (const version of versions) {
    const isRequested = String(version) === requested;
    const card = el('article', isRequested ? 'target requested' : 'target');
    card.append(el('strong', null, `Node ${version}`));
    card.append(
      el('span', isRequested ? 'badge badge-accent' : 'badge', isRequested ? 'Requested' : 'Evaluated')
    );
    elements.targetPaths.append(card);
  }
}

function renderIssues(report) {
  clearElement(elements.issues);
  const issues = report.issues || [];
  if (issues.length === 0) {
    elements.issues.append(createEmptyState('No issues recorded.'));
    return;
  }
  for (const issue of issues) {
    elements.issues.append(buildIssueCard(issue));
  }
}

function buildIssueCard(issue) {
  const card = el('article', 'issue');

  const head = el('div', 'issue-head');
  head.append(tag(issue.category));
  head.append(el('h3', null, issue.title));
  card.append(head);

  if (issue.issue) card.append(buildLabeled('Problem', issue.issue));
  if (issue.incompatibilityReason) card.append(buildLabeled('Why incompatible', issue.incompatibilityReason));
  if (issue.defaultTechnicalRecommendation) {
    card.append(buildLabeled('Recommendation', issue.defaultTechnicalRecommendation));
  }

  if (issue.affectedFiles?.length) {
    const section = el('div', 'issue-section');
    section.append(el('h4', null, 'Affected files'));
    const files = el('div', 'file-list');
    for (const file of issue.affectedFiles) files.append(el('code', 'mono', file));
    section.append(files);
    card.append(section);
  }

  if (issue.evidence?.length) {
    const section = el('div', 'issue-section');
    section.append(el('h4', null, 'Evidence'));
    const rows = el('div', 'evidence-rows');
    for (const ev of issue.evidence) rows.append(buildEvidenceRow(ev));
    section.append(rows);
    card.append(section);
  }

  if (issue.recommendedCommands?.length) {
    const section = el('div', 'issue-section');
    section.append(el('h4', null, 'Commands'));
    const block = codeBlock(issue.recommendedCommands);
    if (block) section.append(block);
    card.append(section);
  }

  if (issue.validationSteps?.length) {
    const section = el('div', 'issue-section');
    section.append(el('h4', null, 'Validation'));
    for (const step of issue.validationSteps) section.append(buildValidationStep(step));
    card.append(section);
  }

  if (issue.alternativeSolutions?.length) {
    const section = el('div', 'issue-section');
    section.append(el('h4', null, 'Alternatives'));
    for (const alt of issue.alternativeSolutions) section.append(buildAlternative(alt));
    card.append(section);
  }

  return card;
}

function buildLabeled(label, body) {
  const wrap = el('div', 'labeled');
  wrap.append(el('p', 'label', label));
  wrap.append(el('p', null, body));
  return wrap;
}

function buildEvidenceRow(ev) {
  const row = el('div', 'evidence-row');
  const loc = ev.line ? `${ev.filePath}:${ev.line}` : ev.filePath;
  row.append(el('code', 'mono', loc || ev.kind || 'evidence'));
  if (ev.summary) row.append(el('p', null, ev.summary));
  if (ev.snippet) row.append(el('pre', 'code-block', ev.snippet));
  return row;
}

function buildValidationStep(step) {
  const wrap = el('div', 'labeled');
  wrap.append(el('strong', null, step.title));
  const block = codeBlock(step.commands);
  if (block) wrap.append(block);
  if (step.expectedResult) wrap.append(el('p', 'muted small', `Expected: ${step.expectedResult}`));
  return wrap;
}

function buildAlternative(alt) {
  const wrap = el('div', 'alt');
  wrap.append(el('strong', null, `#${alt.rank} ${alt.title}`));
  if (alt.targetVersionRange) wrap.append(el('p', 'muted small', `Targets: ${alt.targetVersionRange}`));
  if (alt.summary) wrap.append(el('p', null, alt.summary));
  if (alt.rationale) wrap.append(el('p', 'muted small', alt.rationale));
  if (alt.tradeoffs?.length) wrap.append(bulletList(alt.tradeoffs));
  const block = codeBlock(alt.commands);
  if (block) wrap.append(block);
  return wrap;
}

function renderEvidence(report) {
  clearElement(elements.evidence);
  const entries = report.runtimeEvidence || [];
  if (entries.length === 0) {
    elements.evidence.append(createEmptyState('No runtime evidence captured.'));
    return;
  }
  for (const ev of entries) {
    const card = el('div', 'evidence-card');
    const row1 = el('div', 'row1');
    row1.append(tag(ev.kind));
    row1.append(el('code', 'mono', ev.filePath));
    card.append(row1);
    card.append(el('div', 'value', ev.value));
    if (ev.source) card.append(el('p', 'muted small', `Source: ${ev.source}`));
    elements.evidence.append(card);
  }
}

function renderExecutionPlan(report) {
  clearElement(elements.executionPlan);
  const plan = report.bobExecutionPlan || [];
  if (plan.length === 0) {
    elements.executionPlan.append(createEmptyState('No execution plan saved.'));
    return;
  }
  const sorted = [...plan].sort((a, b) => a.order - b.order);
  for (const item of sorted) {
    const li = el('li', 'plan-item');

    const head = el('div', 'plan-head');
    head.append(el('span', 'plan-num', String(item.order)));
    const headBody = el('div');
    headBody.append(el('strong', null, item.title));
    if (item.phase) headBody.append(el('p', null, `Phase: ${item.phase}`));
    head.append(headBody);
    li.append(head);

    if (item.actions?.length) li.append(bulletList(item.actions));

    if (item.dependsOn?.length) {
      const wrap = el('div', 'labeled');
      wrap.append(el('p', 'label', 'Depends on'));
      const list = el('div', 'dep-list');
      for (const dep of item.dependsOn) list.append(el('code', 'mono', dep));
      wrap.append(list);
      li.append(wrap);
    }

    if (item.validation?.length) {
      const wrap = el('div', 'labeled');
      wrap.append(el('p', 'label', 'Validation'));
      wrap.append(bulletList(item.validation));
      li.append(wrap);
    }

    elements.executionPlan.append(li);
  }
}

function renderValidationChecklist(report) {
  clearElement(elements.validationChecklist);
  const items = report.validationChecklist || [];
  if (items.length === 0) {
    elements.validationChecklist.append(createEmptyState('No validation checklist saved.'));
    return;
  }
  for (const item of items) {
    const card = el('article', 'check');
    card.append(el('strong', null, item.title));
    const block = codeBlock(item.commands);
    if (block) card.append(block);
    if (item.expectedResult) card.append(el('p', 'muted small', `Expected: ${item.expectedResult}`));
    elements.validationChecklist.append(card);
  }
}

function renderToolTrace(report) {
  clearElement(elements.toolTrace);
  const trace = report.toolTrace || [];
  if (trace.length === 0) {
    elements.toolTrace.append(createEmptyState('No tool trace recorded.'));
    return;
  }
  for (const entry of trace) {
    const row = el('div', 'trace-row');
    row.append(el('span', `status status-${entry.status || 'skipped'}`, entry.status || 'unknown'));
    row.append(el('code', 'trace-name', entry.toolName));
    const duration = formatDuration(entry.startedAt, entry.finishedAt);
    const detail = [entry.purpose, entry.resultSummary, duration].filter(Boolean).join(' · ');
    row.append(el('span', 'trace-info', detail));
    elements.toolTrace.append(row);
  }
}

function renderReport(report) {
  renderStats(report);
  renderMeta(report);
  renderDecision(report);
  renderTargetPaths(report);
  renderIssues(report);
  renderEvidence(report);
  renderExecutionPlan(report);
  renderValidationChecklist(report);
  renderToolTrace(report);
  updateRailCounts(report);
}

// ----- History selector + boot ----------------------------------------------

function buildHistoryOptions(manifest) {
  clearElement(elements.historySelect);
  manifest.history.forEach((entry, index) => {
    const option = document.createElement('option');
    option.value = entry.reportPath;
    option.textContent = `${index + 1}. ${entry.reportId} · Node ${entry.requestedTargetNodeVersion}`;
    elements.historySelect.append(option);
  });
}

async function loadReportFromPath(reportPath, manifestUrl) {
  const reportUrl = resolveAgainst(manifestUrl, reportPath);
  return fetchJson(reportUrl);
}

async function boot() {
  setupTabs();

  const manifestPath = config.sampleMode ? config.sampleManifestPath : config.manifestPath;
  const manifestUrl = resolveAgainst(window.location.href, manifestPath);
  const manifest = await fetchJson(manifestUrl);

  buildHistoryOptions(manifest);

  const initialPath = manifest.latestReportPath || manifest.history[0]?.reportPath || null;
  if (!initialPath) throw new Error('Report manifest is empty.');

  elements.historySelect.value = manifest.history[0]?.reportPath || initialPath;
  renderReport(await loadReportFromPath(initialPath, manifestUrl));

  elements.historySelect.addEventListener('change', async (event) => {
    renderReport(await loadReportFromPath(event.target.value, manifestUrl));
  });
}

boot().catch((error) => {
  elements.decisionTitle.textContent = 'Viewer failed to load';
  elements.decisionSummary.textContent = error.message;
  [
    elements.targetPaths,
    elements.issues,
    elements.evidence,
    elements.executionPlan,
    elements.validationChecklist,
    elements.toolTrace
  ].forEach((element) => {
    clearElement(element);
    element.append(createEmptyState(error.message));
  });
});
