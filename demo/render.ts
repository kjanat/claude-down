import type {
	Component,
	ComponentStatus,
	Incident,
} from '#claude-down/browser';
import checkIcon18 from './assets/check-18.svg' with { type: 'text' };
import checkIcon from './assets/check.svg' with { type: 'text' };
import warnIcon from './assets/warn.svg' with { type: 'text' };

import { elements } from './dom.ts';
import type { HeroStatus } from './result.ts';
import { cssToken, escapeHtml, fmt, getDateValue, getString } from './util.ts';

type ComponentStatusView = {
	label: string;
	className: string;
};

const componentStatusLabels: Record<ComponentStatus, string> = {
	operational: 'Operational',
	degraded_performance: 'Degraded',
	partial_outage: 'Partial Outage',
	major_outage: 'Major Outage',
	under_maintenance: 'Maintenance',
};

function isComponentStatus(value: string): value is ComponentStatus {
	return value === 'operational'
		|| value === 'degraded_performance'
		|| value === 'partial_outage'
		|| value === 'major_outage'
		|| value === 'under_maintenance';
}

function getComponentStatusView(status: string): ComponentStatusView {
	if (isComponentStatus(status)) {
		return { label: componentStatusLabels[status], className: status };
	}

	return { label: status, className: 'unknown' };
}

function splitComponentName(
	name: string,
): { main: string; domain: string | null } {
	const match = /^(.+?)\s+\(([^)]+)\)\s*$/.exec(name);

	if (match === null || match[1] === undefined || match[2] === undefined) {
		return { main: name, domain: null };
	}

	return { main: match[1], domain: match[2] };
}

function setLastUpdated(time: Date): void {
	elements.lastUpdated.textContent = `Updated ${time.toLocaleTimeString()}`;
}

function renderError(title: string, message: string): void {
	elements.heroTitle.textContent = title;
	elements.heroSub.textContent = message;
	elements.hero.className = 'hero error';
	elements.heroIcon.className = 'hero-icon error';
	elements.incidentsList.innerHTML = '';
	elements.componentsGrid.innerHTML = '';
}

function renderHero(status: HeroStatus): void {
	const indicator = status.indicator;
	const heroStatus = indicator === 'none' ? 'ok' : cssToken(indicator);

	elements.hero.className = `hero ${heroStatus}`;
	elements.heroIcon.className = `hero-icon ${heroStatus}`;

	elements.heroIcon.innerHTML = indicator === 'none'
		? `${checkIcon}`
		: `${warnIcon}`;

	elements.heroTitle.textContent = status.description;
	elements.heroSub.textContent = indicator === 'none'
		? 'No active incidents'
		: `Indicator: ${indicator}`;
}

function renderIncidents(incidents: Incident[]): void {
	if (incidents.length === 0) {
		elements.incidentsList.innerHTML = `
			<div class="empty-row">
				${checkIcon18}
				No active incidents
			</div>
		`;
		return;
	}

	elements.incidentsList.innerHTML = incidents
		.map((incident) => {
			const record = incident as unknown as Record<string, unknown>;
			const name = getString(record.name, 'Unnamed incident');
			const impact = getString(record.impact, 'unknown');
			const createdAt = getDateValue(record, 'createdAt', 'created_at');
			const updatedAt = getDateValue(record, 'updatedAt', 'updated_at');

			const incName = escapeHtml(name);
			const incImpact = escapeHtml(impact);
			const cssImpact = cssToken(impact);
			const createdAtStr = escapeHtml(fmt(createdAt));
			const updatedAtStr = escapeHtml(fmt(updatedAt));

			return `
				<div class="incident-card">
					<div class="inc-header">
						<span class="inc-name">${incName}</span>
						<span class="inc-badge ${cssImpact}">${incImpact}</span>
					</div>
					<div class="inc-meta">
						Created ${createdAtStr} &middot; Updated ${updatedAtStr}
					</div>
				</div>
			`;
		})
		.join('');
}

function renderComponents(components: Component[]): void {
	elements.componentsGrid.innerHTML = components
		.map((component) => {
			const record = component as unknown as Record<string, unknown>;
			const name = getString(record.name, 'Unnamed component');
			const componentStatus = getString(record.status, 'unknown');
			const view = getComponentStatusView(componentStatus);
			const split = splitComponentName(name);
			const compName = escapeHtml(split.main);
			const compDomain = split.domain === null
				? ''
				: `<span class="comp-domain">${escapeHtml(split.domain)}</span>`;
			const statusLabel = escapeHtml(view.label);
			const className = view.className;

			return `
				<div class="comp-card">
					<div class="comp-dot ${className}"></div>
					<div class="comp-info">
						<div class="comp-name">${compName}${compDomain}</div>
						<div class="comp-status ${className}">${statusLabel}</div>
					</div>
				</div>
			`;
		})
		.join('');
}

export {
	renderComponents,
	renderError,
	renderHero,
	renderIncidents,
	setLastUpdated,
};
