export const RECOVERY_SECURITY = Object.freeze({
    CODE_DIGITS: 6,
    CODE_TTL_MS: 10 * 60 * 1000,
    MAX_FAILED_ATTEMPTS: 5,
    ACCOUNT_INTERVAL_MS: 60 * 1000,
    ACCOUNT_WINDOW_MS: 15 * 60 * 1000,
    ACCOUNT_MAX_REQUESTS: 3,
    IP_WINDOW_MS: 15 * 60 * 1000,
    IP_MAX_REQUESTS: 20,
    IP_MAX_RESETS: 30,
    MAIL_TIMEOUT_MS: 5 * 1000,
    PUBLIC_RESPONSE_MIN_MS: 5 * 1000
});

// Contrato interno de transporte. Aceptación no equivale a entrega al buzón.
export const RECOVERY_MAIL_RESULT = Object.freeze({
    ACCEPTED: 'ACEPTADO',
    REJECTED: 'RECHAZADO',
    AMBIGUOUS: 'AMBIGUO'
});
