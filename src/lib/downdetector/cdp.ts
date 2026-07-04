/**
 * This module provides a simple interface for connecting to a Chrome DevTools Protocol (CDP) target.
 * It allows you to open a new CDP target for a given URL and send commands to it.
 */

/** A function type for sending CDP commands and receiving responses. */
type CdpSend = (
	/** The CDP method to call, e.g. `'Page.navigate'` or `'Runtime.evaluate'`. */
	method: string,
	/** Optional parameters for the CDP method. */
	params?: Record<string, unknown>,
) => Promise<unknown>;

/** Information about a CDP target, including the WebSocket URL for debugging. */
type TargetInfo = {
	/** The WebSocket URL to connect to the CDP target. */
	webSocketDebuggerUrl: string;
};

/** Type guard to check if a value is a {@linkcode TargetInfo} object. */
function isTargetInfo(value: unknown): value is TargetInfo {
	return (
		value !== null
		&& typeof value === 'object'
		&& 'webSocketDebuggerUrl' in value
		&& typeof value.webSocketDebuggerUrl === 'string'
	);
}

/** Type guard to check if a value is a CDP message with an 'id' property. */
function isCdpMessage(value: unknown): value is { id: number } {
	return (
		value !== null
		&& typeof value === 'object'
		&& 'id' in value
		&& typeof value.id === 'number'
	);
}

/** Creates a CDP connection by wrapping a WebSocket and providing a send function for CDP commands. */
function createCdpConnection(ws: WebSocket): CdpSend {
	const pending = new Map<number, (message: unknown) => void>();
	let messageId = 0;

	ws.onmessage = (event) => {
		const text = typeof event.data === 'string'
			? event.data
			: event.data instanceof ArrayBuffer
			? new TextDecoder().decode(event.data)
			: null;
		if (text === null) return;

		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			return;
		}

		if (!isCdpMessage(parsed)) return;

		const callback = pending.get(parsed.id);
		if (typeof callback !== 'function') return;

		pending.delete(parsed.id);
		callback(parsed);
	};

	return (method, params = {}) =>
		new Promise((resolve, reject) => {
			const id = ++messageId;
			const timer = setTimeout(() => {
				pending.delete(id);
				reject(new Error(`CDP command '${method}' timed out`));
			}, 5000);

			pending.set(id, (message) => {
				clearTimeout(timer);
				resolve(message);
			});

			ws.send(JSON.stringify({ id, method, params }));
		});
}

/** Opens a new CDP target for the specified URL and returns an interface for sending CDP commands.
 *
 * @param base - The base URL of the CDP endpoint, e.g. `'http://localhost:9222'`.
 * @param url - The URL to navigate the new CDP target to.
 * @returns A promise that resolves to an object containing a send function for
 * CDP commands and a close function, or an error message if the target could
 * not be opened.
 */
async function openCdpTarget(
	base: string,
	url: string,
): Promise<
	{ ok: true; send: CdpSend; close: () => void } | { ok: false; error: string }
> {
	const targetResponse = await fetch(
		`${base}/json/new?${encodeURIComponent('about:blank')}`,
		{ method: 'PUT' },
	);
	const targetJson: unknown = await targetResponse.json();
	if (!isTargetInfo(targetJson)) {
		return { ok: false, error: 'unexpected CDP target shape' };
	}

	const ws = new WebSocket(targetJson.webSocketDebuggerUrl);
	await new Promise<void>((resolve, reject) => {
		ws.onopen = () => resolve();
		ws.onerror = () => reject(new Error('WebSocket connection failed'));
		ws.onclose = () => reject(new Error('WebSocket closed before opening'));
	});

	const send = createCdpConnection(ws);
	await send('Page.enable');
	await send('Page.navigate', { url });

	return { ok: true, send, close: () => ws.close() };
}

export { openCdpTarget };
export type { CdpSend };
