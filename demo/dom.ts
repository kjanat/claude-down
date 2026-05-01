import idleFaviconHref from './assets/claude-down-grayscale.svg';
import pollingFaviconHref from './assets/claude-down.svg';

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

const faviconHref = {
	polling: pollingFaviconHref,
	idle: idleFaviconHref,
} as const;

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

export { elements, setPollingIcon };
