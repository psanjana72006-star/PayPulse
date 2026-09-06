(function () {
  let services = [];
  let requests = [];
  let riskChartInstance = null;
  let scoreChartInstance = null;

  async function api(path, options) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Request failed');
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function loadAll() {
    [services, requests] = await Promise.all([
      api('/api/services'),
      api('/api/requests'),
    ]);
    render();
  }

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    });
  });

  function monthsSince(dateStr) {
    if (!dateStr) return 999;
    const d = new Date(dateStr);
    const now = new Date();
    return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  }

  function computeScore() {
    if (services.length === 0) return null;
    let penalty = 0;
    services.forEach((s) => {
      if (s.risk === 'high') penalty += 14;
      else if (s.risk === 'medium') penalty += 6;
      if (monthsSince(s.reviewed) > 6) penalty += 3;
    });
    let score = Math.round(100 - penalty);
    if (score < 0) score = 0;
    if (score > 100) score = 100;
    return score;
  }

  function renderScore() {
    const score = computeScore();
    const numEl = document.getElementById('scoreNum');
    const barEl = document.getElementById('scoreBar');
    if (score === null) {
      numEl.textContent = '–';
      barEl.style.width = '0%';
      return;
    }
    numEl.textContent = score;
    barEl.style.width = score + '%';
    const color = score >= 70 ? 'var(--risk-low)' : score >= 40 ? 'var(--risk-med)' : 'var(--risk-high)';
    barEl.style.background = color;
    numEl.style.color = color;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[m]));
  }

  function relativeReviewed(dateStr) {
    if (!dateStr) return 'never';
    const m = monthsSince(dateStr);
    if (m <= 0) return 'this month';
    if (m === 1) return '1 month ago';
    if (m < 12) return m + ' months ago';
    const y = Math.floor(m / 12);
    return y === 1 ? '1 year ago' : y + ' years ago';
  }

  function refreshCategoryFilter() {
    const sel = document.getElementById('filterCategory');
    const current = sel.value;
    const cats = Array.from(new Set(services.map((s) => s.category))).sort();
    sel.innerHTML = '<option value="">All categories</option>' +
      cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    sel.value = current;
  }

  function renderServices() {
    refreshCategoryFilter();
    const catFilter = document.getElementById('filterCategory').value;
    const riskFilter = document.getElementById('filterRisk').value;
    const searchTerm = document.getElementById('searchServices').value.trim().toLowerCase();
    const body = document.getElementById('servicesBody');
    const emptyState = document.getElementById('servicesEmpty');

    let list = services.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (catFilter) list = list.filter((s) => s.category === catFilter);
    if (riskFilter) list = list.filter((s) => s.risk === riskFilter);
    if (searchTerm) list = list.filter((s) => s.name.toLowerCase().includes(searchTerm));

    if (services.length === 0) {
      body.innerHTML = '';
      emptyState.style.display = 'block';
      document.getElementById('servicesTable').style.display = 'none';
      return;
    }
    emptyState.style.display = 'none';
    document.getElementById('servicesTable').style.display = '';

    body.innerHTML = list.map((s) => {
      const stale = monthsSince(s.reviewed) > 6;
      const riskClass = s.risk === 'high' ? 'risk-high' : s.risk === 'medium' ? 'risk-med' : 'risk-low';
      const riskLabel = s.risk === 'high' ? 'High' : s.risk === 'medium' ? 'Medium' : 'Low';
      return `<tr data-id="${s.id}">
        <td><div class="svc-name">${escapeHtml(s.name)}</div><div class="svc-category">${escapeHtml(s.category)}</div></td>
        <td><div class="data-types">${escapeHtml((s.dataTypes || []).join(', ') || '—')}</div></td>
        <td><span class="risk ${riskClass}"><span class="risk-dot"></span>${riskLabel}</span></td>
        <td><span class="reviewed ${stale ? 'stale' : ''}">${relativeReviewed(s.reviewed)}</span></td>
        <td>
          <div class="row-actions">
            <button class="btn ghost small" data-action="mark-reviewed" data-id="${s.id}">Mark reviewed</button>
            <button class="btn danger-text small" data-action="delete-service" data-id="${s.id}">Remove</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  const typeLabels = { export: 'Data export', delete: 'Deletion', access: 'Access / disclosure', 'opt-out': 'Opt-out of sale' };

  function renderRequests() {
    const statusFilter = document.getElementById('filterReqStatus').value;
    const body = document.getElementById('requestsBody');
    const emptyState = document.getElementById('requestsEmpty');

    let list = requests.slice().sort((a, b) => (b.dateFiled || '').localeCompare(a.dateFiled || ''));
    if (statusFilter) list = list.filter((r) => r.status === statusFilter);

    if (requests.length === 0) {
      body.innerHTML = '';
      emptyState.style.display = 'block';
      document.getElementById('requestsTable').style.display = 'none';
      return;
    }
    emptyState.style.display = 'none';
    document.getElementById('requestsTable').style.display = '';

    body.innerHTML = list.map((r) => {
      const riskClass = r.status === 'completed' ? 'risk-low' : r.status === 'denied' ? 'risk-high' : 'risk-med';
      const label = r.status.charAt(0).toUpperCase() + r.status.slice(1);
      const days = daysUntil(r.dueDate);
      const overdue = r.status === 'pending' && days !== null && days < 0;
      const dueDisplay = r.dueDate
        ? `${escapeHtml(r.dueDate)}${overdue ? '<span class="overdue-badge">Overdue</span>' : ''}`
        : '—';
      return `<tr data-id="${r.id}">
        <td><div class="svc-name">${escapeHtml(r.service)}</div>${r.notes ? `<div class="svc-category">${escapeHtml(r.notes)}</div>` : ''}</td>
        <td><div class="data-types">${escapeHtml(typeLabels[r.type] || r.type)}</div></td>
        <td><span class="reviewed">${r.dateFiled ? escapeHtml(r.dateFiled) : '—'}</span></td>
        <td><span class="reviewed">${dueDisplay}</span></td>
        <td><span class="risk ${riskClass}"><span class="risk-dot"></span>${label}</span></td>
        <td>
          <div class="row-actions">
            <button class="btn danger-text small" data-action="delete-request" data-id="${r.id}">Remove</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  function renderRiskChart() {
    const ctx = document.getElementById('riskChart');
    if (!ctx || typeof Chart === 'undefined') return;
    const counts = { low: 0, medium: 0, high: 0 };
    services.forEach((s) => { counts[s.risk] = (counts[s.risk] || 0) + 1; });
    if (riskChartInstance) riskChartInstance.destroy();
    riskChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Low', 'Medium', 'High'],
        datasets: [{ data: [counts.low, counts.medium, counts.high], backgroundColor: ['#6fa87c', '#d1a85e', '#d97a68'] }],
      },
      options: { plugins: { legend: { labels: { color: '#9099a6' } } } },
    });
  }

  async function recordAndRenderScoreHistory(score) {
    const ctx = document.getElementById('scoreChart');
    if (!ctx || typeof Chart === 'undefined') return;
    if (score !== null) {
      try {
        await api('/api/score-history', { method: 'POST', body: JSON.stringify({ score }) });
      } catch (e) { console.error(e); }
    }
    let history = [];
    try {
      history = await api('/api/score-history');
    } catch (e) { console.error(e); }
    if (scoreChartInstance) scoreChartInstance.destroy();
    scoreChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: history.map((h) => h.date),
        datasets: [{ label: 'Privacy score', data: history.map((h) => h.score), borderColor: '#5aada4', tension: 0.3 }],
      },
      options: {
        scales: {
          y: { min: 0, max: 100, ticks: { color: '#9099a6' }, grid: { color: '#2c323c' } },
          x: { ticks: { color: '#9099a6' }, grid: { color: '#2c323c' } },
        },
        plugins: { legend: { labels: { color: '#9099a6' } } },
      },
    });
  }

  function render() {
    renderScore();
    renderServices();
    renderRequests();
    renderRiskChart();
    recordAndRenderScoreHistory(computeScore());
  }

  const serviceForm = document.getElementById('serviceForm');
  document.getElementById('showServiceForm').addEventListener('click', () => {
    serviceForm.classList.add('open');
  });
  document.getElementById('cancelServiceForm').addEventListener('click', () => {
    serviceForm.classList.remove('open');
  });
  document.getElementById('saveService').addEventListener('click', async () => {
    const name = document.getElementById('svcName').value.trim();
    if (!name) { document.getElementById('svcName').focus(); return; }

    const payload = {
      name,
      category: document.getElementById('svcCategory').value,
      dataTypes: document.getElementById('svcData').value.split(',').map((s) => s.trim()).filter(Boolean),
      risk: document.getElementById('svcRisk').value,
      reviewed: document.getElementById('svcReviewed').value,
      notes: document.getElementById('svcNotes').value.trim(),
    };

    try {
      await api('/api/services', { method: 'POST', body: JSON.stringify(payload) });
      await loadAll();
    } catch (e) { console.error(e); alert('Could not save service.'); return; }

    ['svcName', 'svcData', 'svcNotes'].forEach((id) => (document.getElementById(id).value = ''));
    document.getElementById('svcReviewed').value = '';
    document.getElementById('svcCategory').selectedIndex = 0;
    document.getElementById('svcRisk').value = 'low';
    serviceForm.classList.remove('open');
  });

  document.getElementById('servicesBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    try {
      if (btn.dataset.action === 'delete-service') {
        await api('/api/services/' + id, { method: 'DELETE' });
      } else if (btn.dataset.action === 'mark-reviewed') {
        const today = new Date().toISOString().slice(0, 10);
        await api('/api/services/' + id, { method: 'PATCH', body: JSON.stringify({ reviewed: today }) });
      }
      await loadAll();
    } catch (e) { console.error(e); }
  });

  document.getElementById('filterCategory').addEventListener('change', renderServices);
  document.getElementById('filterRisk').addEventListener('change', renderServices);
  document.getElementById('searchServices').addEventListener('input', renderServices);

  const requestForm = document.getElementById('requestForm');
  document.getElementById('showRequestForm').addEventListener('click', () => {
    requestForm.classList.add('open');
  });
  document.getElementById('cancelRequestForm').addEventListener('click', () => {
    requestForm.classList.remove('open');
  });
  document.getElementById('saveRequest').addEventListener('click', async () => {
    const service = document.getElementById('reqService').value.trim();
    if (!service) { document.getElementById('reqService').focus(); return; }

    const payload = {
      service,
      type: document.getElementById('reqType').value,
      dateFiled: document.getElementById('reqDate').value,
      dueDate: document.getElementById('reqDueDate').value,
      status: document.getElementById('reqStatus').value,
      notes: document.getElementById('reqNotes').value.trim(),
    };

    try {
      await api('/api/requests', { method: 'POST', body: JSON.stringify(payload) });
      await loadAll();
    } catch (e) { console.error(e); alert('Could not save request.'); return; }

    ['reqService', 'reqNotes'].forEach((id) => (document.getElementById(id).value = ''));
    document.getElementById('reqDate').value = '';
    document.getElementById('reqDueDate').value = '';
    document.getElementById('reqType').selectedIndex = 0;
    document.getElementById('reqStatus').value = 'pending';
    requestForm.classList.remove('open');
  });

  document.getElementById('requestsBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'delete-request') {
      try {
        await api('/api/requests/' + btn.dataset.id, { method: 'DELETE' });
        await loadAll();
      } catch (e) { console.error(e); }
    }
  });

  document.getElementById('filterReqStatus').addEventListener('change', renderRequests);

  document.getElementById('exportJson').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ services, requests }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dossier-export.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('exportPdf').addEventListener('click', () => {
    if (!window.jspdf) { alert('PDF library did not load. Check your internet connection.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 18;

    doc.setFontSize(18);
    doc.text('Dossier — Privacy Report', 14, y); y += 10;
    doc.setFontSize(11);
    doc.text('Privacy score: ' + (computeScore() ?? '—'), 14, y); y += 14;

    doc.setFontSize(13);
    doc.text('Tracked Services', 14, y); y += 8;
    doc.setFontSize(10);
    if (services.length === 0) { doc.text('None logged.', 14, y); y += 6; }
    services.forEach((s) => {
      doc.text(`${s.name} — ${s.category} — Risk: ${s.risk}`, 14, y);
      y += 6;
      if (y > 270) { doc.addPage(); y = 20; }
    });

    y += 8;
    doc.setFontSize(13);
    doc.text('Data Requests', 14, y); y += 8;
    doc.setFontSize(10);
    if (requests.length === 0) { doc.text('None logged.', 14, y); y += 6; }
    requests.forEach((r) => {
      doc.text(`${r.service} — ${typeLabels[r.type] || r.type} — Status: ${r.status}`, 14, y);
      y += 6;
      if (y > 270) { doc.addPage(); y = 20; }
    });

    doc.save('dossier-report.pdf');
  });

  // ---------- Scan an app ----------
  function renderScanResult(result) {
    const el = document.getElementById('scanResult');
    if (result.error) {
      el.innerHTML = `<div class="scan-error">${escapeHtml(result.message || 'Something went wrong.')}</div>`;
      return;
    }
    const trackerChips = result.trackers.length
      ? result.trackers.map((t) => `<span class="tracker-chip">${escapeHtml(t.name)}</span>`).join('')
      : `<span class="scan-empty">No known trackers found in this report.</span>`;
    const permChips = result.dangerous_permissions.length
      ? result.dangerous_permissions.map((p) => `<span class="perm-chip">${escapeHtml(p)}</span>`).join('')
      : `<span class="scan-empty">No sensitive permissions flagged.</span>`;

    el.innerHTML = `
      <div class="scan-card">
        <div class="scan-card-header">
          <div>
            <div class="scan-app-name">${escapeHtml(result.app_name)}</div>
            <div class="scan-app-meta">${escapeHtml(result.handle)} · v${escapeHtml(result.version || '—')} · updated ${escapeHtml(result.updated || '—')}</div>
          </div>
        </div>
        <div class="scan-section">
          <h4>${result.tracker_count} tracker(s) found</h4>
          <div class="tracker-list">${trackerChips}</div>
        </div>
        <div class="scan-section">
          <h4>${result.permissions_total} permission(s) requested — sensitive ones flagged below</h4>
          <div class="perm-list">${permChips}</div>
        </div>
        <div class="scan-section">
          <a href="${result.source_report_url}" target="_blank" rel="noopener">View full report on εxodus Privacy →</a>
        </div>
      </div>`;
  }

  document.getElementById('scanBtn').addEventListener('click', async () => {
    const handle = document.getElementById('scanHandle').value.trim();
    const el = document.getElementById('scanResult');
    if (!handle) { document.getElementById('scanHandle').focus(); return; }
    el.innerHTML = `<div class="scan-loading">Looking up ${escapeHtml(handle)}…</div>`;
    try {
      const res = await fetch('/api/lookup/' + encodeURIComponent(handle));
      const result = await res.json();
      renderScanResult(result);
    } catch (e) {
      renderScanResult({ error: true, message: 'Could not reach the server.' });
    }
  });

  loadAll();
})();