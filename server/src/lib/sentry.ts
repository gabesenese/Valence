import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  const isProd = process.env.NODE_ENV === 'production';
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: isProd ? 0.1 : 1.0,
    sendDefaultPii: false,
    beforeSend(event) {
      const req = event.request as Record<string, unknown> | undefined;
      if (req) {
        const headers = req.headers as Record<string, unknown> | undefined;
        if (headers) {
          for (const key of Object.keys(headers)) {
            if (/^(authorization|cookie|x-admin-secret)$/i.test(key)) delete headers[key];
          }
        }
        delete req.data;
        delete req.cookies;
      }
      return event;
    },
  });
}

export { Sentry };
