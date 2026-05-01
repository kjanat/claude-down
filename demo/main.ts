import { checkAnthropic } from '#claude-down/browser';
import type { Component, ComponentStatus, Incident } from '#claude-down/browser';
import idleFaviconHref from './claude-down-grayscale.svg';
import pollingFaviconHref from './claude-down.svg';

type StatusLabel = {
	label: string;
	color: string;
};

type HeroStatus = {
	description: string;
	indicator: string;
};

type StatusSummary = {
	status: HeroStatus;
	incidents: Incident[];
	components: Component[];
};

const statusLabels = {
	operational: { label: 'Operational', color: '#22c55e' },
	degraded_performance: { label: 'Degraded', color: '#f59e0b' },
	partial_outage: { label: 'Partial Outage', color: '#f97316' },
	major_outage: { label: 'Major Outage', color: '#ef4444' },
	under_maintenance: { label: 'Maintenance', color: '#6366f1' },
} satisfies Partial<Record<ComponentStatus, StatusLabel>>;

const knownComponentStatuses = new Set<string>(Object.keys(statusLabels));

const DEFAULT_POLL_INTERVAL_MS = 10_000;
const MAX_POLL_INTERVAL_MS = 60_000;
const MIN_POLL_INTERVAL_MS = 3_000;

const faviconHref = {
	polling: pollingFaviconHref,
	idle: idleFaviconHref,
} as const;

let pollTimer: number | undefined;
let pollInFlight = false;
let pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;

function clampPollInterval(ms: number): number {
	return Math.min(Math.max(ms, MIN_POLL_INTERVAL_MS), MAX_POLL_INTERVAL_MS);
}

function getCacheDirectiveSeconds(cacheControl: string | null, directiveName: string): number | null {
	if (cacheControl === null) {
		return null;
	}

	for (const directive of cacheControl.split(',')) {
		const [name, rawValue] = directive.trim().split('=');

		if (name === undefined || rawValue === undefined) {
			continue;
		}

		if (name.toLowerCase() !== directiveName) {
			continue;
		}

		const seconds = Number(rawValue.trim().replace(/^"|"$/g, ''));

		if (Number.isFinite(seconds) && seconds > 0) {
			return seconds;
		}
	}

	return null;
}

function getHeaderPollInterval(headers: Headers): number {
	const cacheControl = headers.get('cache-control');

	const seconds = getCacheDirectiveSeconds(cacheControl, 's-maxage')
		?? getCacheDirectiveSeconds(cacheControl, 'max-age');

	if (seconds === null) {
		return DEFAULT_POLL_INTERVAL_MS;
	}

	return clampPollInterval(seconds * 1000);
}

function getElement(id: string): HTMLElement {
	const element = document.getElementById(id);

	if (!element) {
		throw new Error(`Missing #${id}`);
	}

	return element;
}

function getFaviconElement(): HTMLLinkElement {
	const element = document.querySelector('link[rel~="icon"]');

	if (element instanceof HTMLLinkElement) {
		return element;
	}

	const favicon = document.createElement('link');
	favicon.rel = 'icon';
	favicon.type = 'image/svg+xml';
	favicon.sizes.value = 'any';
	document.head.append(favicon);

	return favicon;
}

const elements = {
	lastUpdated: getElement('last-updated'),
	hero: getElement('hero'),
	heroIcon: getElement('hero-icon'),
	heroSub: getElement('hero-sub'),
	heroTitle: getElement('hero-title'),
	incidentsList: getElement('incidents-list'),
	componentsGrid: getElement('components-grid'),
	favicon: getFaviconElement(),
};

function setPollingIcon(polling: boolean): void {
	const href = polling ? faviconHref.polling : faviconHref.idle;
	if (elements.favicon.getAttribute('href') === href) {
		return;
	}

	const next = document.createElement('link');
	next.id = 'favicon';
	next.rel = 'icon';
	next.type = 'image/svg+xml';
	next.sizes.value = 'any';
	next.href = href;

	elements.favicon.replaceWith(next);
	elements.favicon = next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function escapeHtml(value: unknown): string {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function cssToken(value: unknown): string {
	return String(value).replaceAll(/[^\w-]/g, '');
}

function getString(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function getDateValue(record: Record<string, unknown>, camelKey: string, snakeKey: string): string | number | Date {
	const value = record[camelKey] ?? record[snakeKey];

	if (
		typeof value === 'string'
		|| typeof value === 'number'
		|| value instanceof Date
	) {
		return value;
	}

	return new Date();
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function getResultErrorMessage(result: unknown): string {
	if (!isRecord(result)) {
		return getErrorMessage(result);
	}

	const reason = result.reason ?? result.error ?? result.message;

	if (reason instanceof Error) {
		return reason.message;
	}

	if (typeof reason === 'string') {
		return reason;
	}

	return 'Unknown error';
}

function getResultHeaders(result: unknown): Headers | undefined {
	if (!isRecord(result)) {
		return undefined;
	}

	return result.headers instanceof Headers ? result.headers : undefined;
}

function isFailureResult(result: unknown): boolean {
	if (!isRecord(result)) {
		return false;
	}

	if (result.kind !== undefined) {
		return result.kind !== 'ok';
	}

	if (result.ok !== undefined) {
		return result.ok !== true;
	}

	if (result.success !== undefined) {
		return result.success !== true;
	}

	return false;
}

function getPayload(result: unknown): unknown {
	if (!isRecord(result)) {
		return result;
	}

	return result.summary
		?? result.data
		?? result.value
		?? result.result
		?? result;
}

function normalizeHeroStatus(value: unknown): HeroStatus {
	if (isRecord(value)) {
		const indicator = getString(value.indicator, 'none');
		const description = getString(
			value.description,
			indicator === 'none' ? 'All Systems Operational' : `Indicator: ${indicator}`,
		);

		return { description, indicator };
	}

	if (typeof value === 'string') {
		return {
			description: value,
			indicator: value === 'operational' ? 'none' : value,
		};
	}

	return {
		description: 'Unknown status',
		indicator: 'major',
	};
}

function normalizeSummary(result: unknown): StatusSummary {
	const payload = getPayload(result);

	if (!isRecord(payload)) {
		throw new Error('Invalid status response');
	}

	return {
		status: normalizeHeroStatus(payload.status),
		incidents: Array.isArray(payload.incidents) ? payload.incidents as Incident[] : [],
		components: Array.isArray(payload.components) ? payload.components as Component[] : [],
	};
}

function fmt(value: string | number | Date): string {
	return new Date(value).toLocaleString(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	});
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
	elements.heroSub.textContent = indicator === 'none' ? 'No active incidents' : `Indicator: ${indicator}`;
}

function renderIncidents(incidents: Incident[]): void {
	if (incidents.length === 0) {
		elements.incidentsList.innerHTML = `
			<div class="empty-row">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
					stroke="currentColor" stroke-width="2">
					<path d="M20 6L9 17l-5-5"/>
				</svg>
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

			return `
				<div class="incident-card">
					<div class="inc-header">
						<span class="inc-name">${escapeHtml(name)}</span>
						<span class="inc-badge ${cssToken(impact)}">${escapeHtml(impact)}</span>
					</div>
					<div class="inc-meta">
						Created ${escapeHtml(fmt(createdAt))} &middot; Updated ${escapeHtml(fmt(updatedAt))}
					</div>
				</div>
			`;
		})
		.join('');
}

function getComponentStatusLabel(status: string): StatusLabel {
	if (!knownComponentStatuses.has(status)) {
		return { label: status, color: '#94a3b8' };
	}

	return statusLabels[status as ComponentStatus] ?? { label: status, color: '#94a3b8' };
}

function renderComponents(components: Component[]): void {
	elements.componentsGrid.innerHTML = components
		.map((component) => {
			const record = component as unknown as Record<string, unknown>;
			const name = getString(record.name, 'Unnamed component');
			const componentStatus = getString(record.status, 'unknown');
			const status = getComponentStatusLabel(componentStatus);

			return `
				<div class="comp-card">
					<div class="comp-dot" style="background:${status.color}"></div>
					<div class="comp-info">
						<div class="comp-name">${escapeHtml(name)}</div>
						<div class="comp-status" style="color:${status.color}">${escapeHtml(status.label)}</div>
					</div>
				</div>
			`;
		})
		.join('');
}

async function updateStatus(): Promise<number | undefined> {
	const result: unknown = await checkAnthropic();
	const headers = getResultHeaders(result);

	elements.lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}`;

	if (isFailureResult(result)) {
		renderError('Error', getResultErrorMessage(result));
		return headers === undefined ? undefined : getHeaderPollInterval(headers);
	}

	const { status, incidents, components } = normalizeSummary(result);

	renderHero(status);
	renderIncidents(incidents);
	renderComponents(components);

	return headers === undefined ? undefined : getHeaderPollInterval(headers);
}

function showException(error: unknown): void {
	renderError('Exception', getErrorMessage(error));
}

function clearPollTimer(): void {
	if (pollTimer === undefined) {
		return;
	}

	window.clearTimeout(pollTimer);
	pollTimer = undefined;
}

function stopPolling(): void {
	clearPollTimer();
	setPollingIcon(false);
}

function schedulePoll(delayMs = pollIntervalMs): void {
	clearPollTimer();

	if (document.visibilityState !== 'visible') {
		stopPolling();
		return;
	}

	const delay = Math.max(0, delayMs);

	setPollingIcon(true);

	pollTimer = window.setTimeout(() => {
		void poll();
	}, delay);
}

function startPolling(): void {
	if (document.visibilityState !== 'visible') {
		stopPolling();
		return;
	}

	setPollingIcon(true);

	if (pollInFlight) {
		return;
	}

	void poll();
}

async function poll(): Promise<void> {
	clearPollTimer();

	if (document.visibilityState !== 'visible') {
		stopPolling();
		return;
	}

	if (pollInFlight) {
		return;
	}

	pollInFlight = true;
	setPollingIcon(true);

	try {
		pollIntervalMs = (await updateStatus()) ?? pollIntervalMs;
	} catch (error) {
		showException(error);
	} finally {
		pollInFlight = false;
	}

	schedulePoll();
}

document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'visible') {
		startPolling();
	} else {
		stopPolling();
	}
});

startPolling();
