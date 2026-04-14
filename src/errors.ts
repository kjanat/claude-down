import { CLIError } from '@kjanat/dreamcli';

import { EXIT_CODES } from '#claude-down/constants.ts';

type ErrorSource = 'ANTHROPIC' | 'DOWNDETECTOR' | 'SOURCES';
type ErrorSeverity = 'UNAVAILABLE';

type ErrorCode = `${ErrorSource}_${ErrorSeverity}`;

type ExtractSource<Code extends ErrorCode> = Code extends `${infer S extends ErrorSource}_${ErrorSeverity}` ? S
	: never;

type AppError<C extends ErrorCode = ErrorCode> = {
	code: C;
	message: string;
	details: Record<Lowercase<ExtractSource<C>>, string>;
};

function toCLIError<C extends ErrorCode>(err: AppError<C>): CLIError {
	return new CLIError(err.message, {
		code: err.code,
		exitCode: EXIT_CODES.unavailable,
		details: err.details,
	});
}

export type { AppError, ErrorCode };
export { toCLIError };
