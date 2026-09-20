// DI token for the Better Auth instance. Defined here (shared kernel),
// provided by modules/auth — guards inject this instead of the concrete
// singleton (ADR-005 dependency inversion), so tests can pass fakes.
export const AUTH = 'AUTH';
