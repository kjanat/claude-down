import { EXIT_CODES } from '#claude-down/lib/constants.ts';
import { CLIError } from '@kjanat/dreamcli';

/**
 * Defines the structure of application errors, including a code, message, and details.
 *
 * The error code is a combination of the source of the error and its severity.
 */
type ErrorSource = 'ANTHROPIC' | 'DOWNDETECTOR' | 'SOURCES';
/** The severity of the error, indicating that the service is unavailable. */
type ErrorSeverity = 'UNAVAILABLE';

/** Combines the error source and severity to create a unique error code. */
type ErrorCode = `${ErrorSource}_${ErrorSeverity}`;

/** Extracts the source of the error from the error code. */
type ExtractSource<Code extends ErrorCode> = Code extends `${infer S extends ErrorSource}_${ErrorSeverity}` ? S
	: never;

/**
 * Represents an application error with a specific code, message, and details.
 *
 * The details are a record of the error source and its corresponding message.
 */
type AppError<C extends ErrorCode = ErrorCode> = {
	code: C;
	message: string;
	details: Record<Lowercase<ExtractSource<C>>, string>;
};

/**
 * Converts an application error into a CLIError, which can be used for command-line interfaces.
 *
 * The CLIError includes the error message, code, exit code, and details for better error handling in CLI applications.
 */
function toCLIError<C extends ErrorCode>(err: AppError<C>): CLIError {
	return new CLIError(err.message, {
		code: err.code,
		exitCode: EXIT_CODES.unavailable,
		details: err.details,
	});
}

export type { AppError, ErrorCode };
export { toCLIError };
