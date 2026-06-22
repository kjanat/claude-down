import { spawn } from 'node:child_process';
import { platform } from 'node:process';

type BrowserOpenCommand = Readonly<{
	args: readonly string[];
	command: string;
}>;

function defaultBrowserOpenCommand(
	url: string,
	currentPlatform: NodeJS.Platform = platform,
): BrowserOpenCommand {
	switch (currentPlatform) {
		case 'darwin':
			return { command: 'open', args: [url] };
		case 'win32':
			return { command: 'cmd', args: ['/c', 'start', '', url] };
		default:
			return { command: 'xdg-open', args: [url] };
	}
}

function openUrlInDefaultBrowser(url: string): Promise<void> {
	const { args, command } = defaultBrowserOpenCommand(url);

	return new Promise((resolve, reject) => {
		const child = spawn(command, [...args], {
			detached: true,
			stdio: 'ignore',
		});

		child.once('error', reject);
		child.once('spawn', () => {
			child.unref();
			resolve();
		});
	});
}

export { defaultBrowserOpenCommand, openUrlInDefaultBrowser };
export type { BrowserOpenCommand };
