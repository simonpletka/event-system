import type { Instrumentation } from "next";

/**
 * Every server error (page render, server action, route handler) lands here
 * with the same digest the error page shows as "ref", so a reported ref leads
 * straight to the message and stack in the logs. Headers are deliberately not
 * logged (they include the session cookie).
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { log } = await import("@/lib/log");
  log.error("request_error", err, {
    method: request.method,
    path: request.path,
    routeType: context.routeType,
    routePath: context.routePath,
  });
};
