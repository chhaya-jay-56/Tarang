import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://9ce9e56496a8516465cc900eb7573415@o4511688196882432.ingest.us.sentry.io/4511688241119232",

  // 20% of traces in production — 100% is expensive
  tracesSampleRate: 0.2,

  beforeSend(event) {
    // ── PII scrubbing: strip auth tokens and sensitive headers ──
    if (event.request?.headers) {
      delete event.request.headers["Authorization"];
      delete event.request.headers["authorization"];
      delete event.request.headers["Cookie"];
      delete event.request.headers["cookie"];
    }
    if (event.request?.cookies) {
      event.request.cookies = {};
    }
    return event;
  },
});
