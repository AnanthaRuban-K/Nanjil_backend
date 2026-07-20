import { bodyLimit } from "hono/body-limit";

export const MAX_REQUEST_BODY_BYTES = 64 * 1024;

export const requestBodyLimitMiddleware = bodyLimit({
  maxSize: MAX_REQUEST_BODY_BYTES,
  onError: (c) =>
    c.json(
      { success: false, message: "Request body is too large" },
      413
    ),
});
