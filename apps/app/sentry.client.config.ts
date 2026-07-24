import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://9ce9e56496a8516465cc900eb7573415@o4511688196882432.ingest.us.sentry.io/4511688241119232",

  // 20% of traces in production — 100% is expensive and leaks request data
  tracesSampleRate: 0.2,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  
  tracePropagationTargets: ["localhost", /^https:\/\/api\.trytarang\.app\/api/],
  
  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  beforeSend(event) {
    // ── PII scrubbing: strip auth tokens and sensitive headers ──
    if (event.request?.headers) {
      delete event.request.headers["Authorization"];
      delete event.request.headers["authorization"];
      delete event.request.headers["Cookie"];
      delete event.request.headers["cookie"];
      delete event.request.headers["X-Tarang-Secret"];
      delete event.request.headers["x-tarang-secret"];
    }
    if (event.request?.cookies) {
      event.request.cookies = {};
    }

    // ── Dev user filtering ──
    const ignoredUsers = ["jay chhaya", "nilesh chhaya", "jay.chhaya", "nilesh.chhaya"];
    if (event.user) {
      const userName = (event.user.username || event.user.name || event.user.email || "").toLowerCase();
      if (ignoredUsers.some(ignored => userName.includes(ignored))) {
        return null;
      }
    }
    return event;
  },
});
