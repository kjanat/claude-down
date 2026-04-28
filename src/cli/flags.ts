import { flag } from '@kjanat/dreamcli';

const sources = ['anthropic', 'downdetector'] as const;

type Source = (typeof sources)[number];

const quietFlag = flag.boolean().alias('q').describe('Silent; exit code only');

const sourceSelectionFlag = flag
	.array(flag.enum(sources))
	.default([...sources])
	.alias('s')
	.describe('Data source(s) to check');

export { quietFlag, sources, sourceSelectionFlag };
export type { Source };
