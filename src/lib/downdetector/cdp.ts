type CdpSend = (method: string, params?: Record<string, unknown>) => Promise<unknown>;

type TargetInfo = {
	webSocketDebuggerUrl: string;
};

function isTargetInfo(value: unknown): value is TargetInfo {
	return (
		value !== null
		&& typeof value === 'object'
		&& 'webSocketDebuggerUrl' in value
		&& typeof value.webSocketDebuggerUrl === 'string'
	);
}

function isCdpMessage(value: unknown): value is { id: number } {
	return value !== null && typeof value === 'object' && 'id' in value && typeof value.id === 'number';
}

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
		if (callback === undefined) return;

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

async function openCdpTarget(
	base: string,
	url: string,
): Promise<{ ok: true; send: CdpSend; close: () => void } | { ok: false; error: string }> {
	const targetResponse = await fetch(`${base}/json/new?${encodeURIComponent(url)}`, {
		method: 'PUT',
	});
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

	return { ok: true, send: createCdpConnection(ws), close: () => ws.close() };
}

export { openCdpTarget };
export type { CdpSend };
