import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { formatStatusRows } from './main.ts';

describe('formatStatusRows', () => {
	test('renders concise multiline status output', () => {
		assert.equal(
			formatStatusRows([
				{
					source: 'anthropic',
					status: 'major',
					details: 'Partial System Outage',
					incidents: [{ name: 'API elevated errors', status: 'identified' }],
					affected: [
						{ name: 'claude.ai', status: 'major_outage' },
						{ name: 'Claude Code', status: 'partial_outage' },
					],
				},
				{
					source: 'downdetector',
					status: 'down',
					details: 'User reports show problems with Claude AI',
				},
			]),
			[
				'Anthropic: major',
				'  Partial System Outage',
				'  incident: API elevated errors [identified]',
				'  affected: claude.ai [major_outage], Claude Code [partial_outage]',
				'',
				'Downdetector: down',
				'  User reports show problems with Claude AI',
			].join('\n'),
		);
	});

	test('skips empty optional sections', () => {
		assert.equal(
			formatStatusRows([
				{
					source: 'downdetector',
					status: 'up',
					details: null,
				},
			]),
			'Downdetector: up',
		);
	});
});
