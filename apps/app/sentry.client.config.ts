import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://9ce9e56496a8516465cc900eb7573415@o4511688196882432.ingest.us.sentry.io/4511688241119232",

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
  
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.

  beforeSend(event) {
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
