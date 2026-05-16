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
  targetPaths: document.getElementById('target-paths'),
  issues: document.getElementById('issues'),
  evidence: document.getElementById('evidence'),
  executionPlan: document.getElementById('execution-plan'),
  validationChecklist: document.getElementById('validation-checklist'),
  toolTrace: document.getElementById('tool-trace')
};

function resolveAgainst(baseUrl, relativePath) {
  return new URL(relativePath, baseUrl).toString();
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }

  return response.json();
}

function createEmptyState(message) {
  const node = document.createElement('div');
  node.className = 'empty';
  node.textContent = message;
  return node;
}

function clearElement(element) {
  element.replaceChildren();
}

function appendCompactCard(container, title, body) {
  const card = document.createElement('article');
  card.className = 'compact-card';
  card.innerHTML = `<strong>${title}</strong><p>${body}</p>`;
  container.append(card);
}

function renderMeta(report) {
  clearElement(elements.reportMeta);

  const items = [
    ['Report ID', report.reportId],
    ['Created At', report.createdAt],
    ['Repo Root', report.repoRoot],
    ['Target Node', report.requestedTargetNodeVersion],
    ['Package Manager', report.detectedPackageManager],
    ['Offline Mode', report.offlineMode ? 'Yes' : 'No']
  ];

  items.forEach(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'meta-item';
    item.innerHTML = `<strong>${label}</strong><small>${value || 'n/a'}</small>`;
    elements.reportMeta.append(item);
  });
}

function renderDecision(report) {
  elements.decisionTitle.textContent = report.bobDecision.selectedTargetPath;
  elements.decisionSummary.textContent = report.bobDecision.summary;
  clearElement(elements.decisionPills);

  [
    `Requested: Node ${report.requestedTargetNodeVersion}`,
    `Evaluated: ${report.evaluatedTargetNodeVersions.join(', ')}`,
    `Risks: ${report.bobDecision.prioritizedRisks.length}`,
    `Chosen solutions: ${report.bobDecision.chosenSolutions.length}`
  ].forEach((text) => {
    const pill = document.createElement('div');
    pill.className = 'pill';
    pill.textContent = text;
    elements.decisionPills.append(pill);
  });
}

function renderTargetPaths(report) {
  clearElement(elements.targetPaths);

  const pathCards = report.evaluatedTargetNodeVersions.map((version, index) => {
    const card = document.createElement('article');
    card.className = 'card';
    const isSelected = report.bobDecision.selectedTargetPath.includes(version);
    card.innerHTML = `
      <strong>Target ${index + 1}</strong>
      <p>Node ${version}</p>
      <div class="score-row">
        <span class="score">${isSelected ? 'Selected by Bob' : 'Evaluated option'}</span>
      </div>
    `;
    return card;
  });

  if (pathCards.length === 0) {
    elements.targetPaths.append(createEmptyState('No evaluated target paths were saved.'));
    return;
  }

  pathCards.forEach((card) => elements.targetPaths.append(card));
}

function renderIssues(report) {
  clearElement(elements.issues);

  if (report.issues.length === 0) {
    elements.issues.append(createEmptyState('No issues were recorded in this report.'));
    return;
  }

  report.issues.forEach((issue) => {
    const card = document.createElement('article');
    card.className = 'issue-card';
    const evidenceCount = issue.evidence.length;
    const validationCount = issue.validationSteps.length;
    card.innerHTML = `
      <div class="issue-category">${issue.category}</div>
      <strong>${issue.title}</strong>
      <p>${issue.issue}</p>
      <p>${issue.defaultTechnicalRecommendation}</p>
      <div class="score-row">
        <span class="score">${evidenceCount} evidence item${evidenceCount === 1 ? '' : 's'}</span>
        <span class="score">${validationCount} validation step${validationCount === 1 ? '' : 's'}</span>
      </div>
    `;
    elements.issues.append(card);
  });
}

function renderEvidence(report) {
  clearElement(elements.evidence);

  if (report.runtimeEvidence.length === 0) {
    elements.evidence.append(createEmptyState('No runtime evidence was captured.'));
    return;
  }

  report.runtimeEvidence.forEach((entry) => {
    appendCompactCard(
      elements.evidence,
      `${entry.kind} · ${entry.filePath}`,
      `${entry.source}: ${entry.value}`
    );
  });
}

function renderExecutionPlan(report) {
  clearElement(elements.executionPlan);

  if (report.bobExecutionPlan.length === 0) {
    elements.executionPlan.append(createEmptyState('No execution plan items were saved.'));
    return;
  }

  report.bobExecutionPlan
    .sort((left, right) => left.order - right.order)
    .forEach((item) => {
      const card = document.createElement('article');
      card.className = 'plan-card';
      card.innerHTML = `
        <strong>${item.order}. ${item.title}</strong>
        <p>${item.phase}</p>
      `;

      const list = document.createElement('ul');
      list.className = 'list';
      item.actions.forEach((action) => {
        const bullet = document.createElement('li');
        bullet.textContent = action;
        list.append(bullet);
      });
      card.append(list);
      elements.executionPlan.append(card);
    });
}

function renderValidationChecklist(report) {
  clearElement(elements.validationChecklist);

  if (report.validationChecklist.length === 0) {
    elements.validationChecklist.append(
      createEmptyState('No validation checklist items were saved.')
    );
    return;
  }

  report.validationChecklist.forEach((item) => {
    appendCompactCard(
      elements.validationChecklist,
      item.title,
      `${item.expectedResult} Commands: ${item.commands.join(' | ')}`
    );
  });
}

function renderToolTrace(report) {
  clearElement(elements.toolTrace);

  if (report.toolTrace.length === 0) {
    elements.toolTrace.append(createEmptyState('No tool trace entries were saved.'));
    return;
  }

  report.toolTrace.forEach((entry) => {
    appendCompactCard(
      elements.toolTrace,
      `${entry.toolName} · ${entry.status}`,
      `${entry.resultSummary} (${entry.startedAt} -> ${entry.finishedAt})`
    );
  });
}

function renderReport(report) {
  renderMeta(report);
  renderDecision(report);
  renderTargetPaths(report);
  renderIssues(report);
  renderEvidence(report);
  renderExecutionPlan(report);
  renderValidationChecklist(report);
  renderToolTrace(report);
}

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
  const manifestPath = config.sampleMode ? config.sampleManifestPath : config.manifestPath;
  const manifestUrl = resolveAgainst(window.location.href, manifestPath);
  const manifest = await fetchJson(manifestUrl);

  buildHistoryOptions(manifest);

  const initialPath =
    manifest.latestReportPath || manifest.history[0]?.reportPath || null;

  if (!initialPath) {
    throw new Error('Report manifest is empty.');
  }

  elements.historySelect.value = manifest.history[0]?.reportPath || initialPath;
  renderReport(await loadReportFromPath(initialPath, manifestUrl));

  elements.historySelect.addEventListener('change', async (event) => {
    const nextPath = event.target.value;
    renderReport(await loadReportFromPath(nextPath, manifestUrl));
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
