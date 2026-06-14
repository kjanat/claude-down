/** Flags that make dreamcli render help instead of running a command. */
const HELP_FLAGS = new Set(['--help', '-h']);

/** Whether the given argv (without the node/script prefix) requests help. */
function wantsHelp(args: readonly string[]): boolean {
	return args.some((arg) => HELP_FLAGS.has(arg));
}

/**
 * Trailing line appended under `--help`, pointing at the no-install web page.
 * dreamcli exposes no help footer hook, so the binary prints this itself.
 */
function helpFooter(siteUrl: string): string {
	return `\nNo terminal? Watch the live status page: ${siteUrl}\n`;
}

export { helpFooter, wantsHelp };
