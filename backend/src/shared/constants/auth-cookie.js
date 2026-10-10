const isProduction = process.env.NODE_ENV === 'production';

export const AUTH_COOKIE_OPTIONS = Object.freeze({
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax'
});

export const AUTH_COOKIE_MAX_AGE = 8 * 60 * 60 * 1000;
