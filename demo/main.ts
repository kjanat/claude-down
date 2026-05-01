import { checkAnthropic } from '#claude-down/browser';

type StatusLabel = {
	label: string;
	color: string;
};

const statusLabels: Record<string, StatusLabel> = {
	operational: { label: 'Operational', color: '#22c55e' },
	degraded_performance: { label: 'Degraded', color: '#f59e0b' },
	partial_outage: { label: 'Partial Outage', color: '#f97316' },
	major_outage: { label: 'Major Outage', color: '#ef4444' },
	under_maintenance: { label: 'Maintenance', color: '#6366f1' },
};

function getElement(id: string): HTMLElement {
	const element = document.getElementById(id);
	if (element === null) {
		throw new Error(`Missing #${id}`);
	}

	return element;
}

function getElements() {
	return {
		lastUpdated: getElement('last-updated'),
		hero: getElement('hero'),
		heroIcon: getElement('hero-icon'),
		heroSub: getElement('hero-sub'),
		heroTitle: getElement('hero-title'),
		incidentsList: getElement('incidents-list'),
		componentsGrid: getElement('components-grid'),
	};
}

function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function fmt(iso: string | number | Date) {
	return new Date(iso).toLocaleString(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	});
}

async function run() {
	const elements = getElements();
	const result = await checkAnthropic();

	elements.lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}`;

	if (result.kind !== 'ok') {
		elements.heroTitle.textContent = 'Error';
		elements.heroSub.textContent = result.reason;
		elements.hero.className = 'hero error';
		elements.heroIcon.className = 'hero-icon error';
		elements.incidentsList.innerHTML = '';
		elements.componentsGrid.innerHTML = '';
		return;
	}

	const { status, incidents, components } = result.summary;
	const ind = status.indicator; // 'none' | 'minor' | 'major' | 'critical'

	// ── Hero banner ────────────────────────────────────────────────
	elements.hero.className = `hero ${ind === 'none' ? 'ok' : ind}`;
	elements.heroIcon.className = `hero-icon ${ind === 'none' ? 'ok' : ind}`;
	elements.heroIcon.innerHTML = ind === 'none'
		? `<svg width="32" height="32" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5">
         <path d="M20 6L9 17l-5-5"/>
       </svg>`
		: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5">
         <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94
                  a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
       </svg>`;

	elements.heroTitle.textContent = status.description;
	elements.heroSub.textContent = ind === 'none' ? 'No active incidents' : `Indicator: ${ind}`;

	// ── Incidents ──────────────────────────────────────────────────
	if (!incidents || incidents.length === 0) {
		elements.incidentsList.innerHTML = `
      <div class="empty-row">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
		No active incidents
      </div>`;
	} else {
		elements.incidentsList.innerHTML = incidents
			.map(
				(inc) => `
      <div class="incident-card">
        <div class="inc-header">
          <span class="inc-name">${inc.name}</span>
          <span class="inc-badge ${inc.impact}">${inc.impact}</span>
        </div>
        <div class="inc-meta">
          Created ${fmt(inc.created_at)} &middot; Updated ${fmt(inc.updated_at)}
        </div>
      </div>`,
			)
			.join('');
	}

	// ── Components ─────────────────────────────────────────────────
	elements.componentsGrid.innerHTML = components
		.map((c) => {
			const s = statusLabels[c.status] ?? { label: c.status, color: '#94a3b8' };
			return `
      <div class="comp-card">
        <div class="comp-dot" style="background:${s.color}"></div>
        <div class="comp-info">
          <div class="comp-name">${c.name}</div>
          <div class="comp-status" style="color:${s.color}">${s.label}</div>
        </div>
      </div>`;
		})
		.join('');
}

run().catch((error: unknown) => {
	const elements = getElements();
	elements.heroTitle.textContent = 'Exception';
	elements.heroSub.textContent = getErrorMessage(error);
	elements.hero.className = 'hero error';
});
