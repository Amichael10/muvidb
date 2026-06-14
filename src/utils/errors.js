/**
 * Utility to translate raw developer, network, or database errors into clear,
 * empathetic, and understandable plain English for users.
 *
 * @param {any} error - The error object, string, or network response.
 * @returns {string} - A human-friendly error message.
 */
export function getFriendlyErrorMessage(error) {
  if (!error) {
    return "Something went wrong. Please try again.";
  }

  // Handle case where error is passed as a string
  const message = (typeof error === 'string' 
    ? error 
    : error.message || error.error_description || String(error)
  ).toLowerCase();

  const status = error.status || error.code;

  // 1. Connection & Offline Errors
  if (
    message.includes("failed to fetch") ||
    message.includes("network error") ||
    message.includes("load failed") ||
    message.includes("network request failed") ||
    message.includes("connection refused")
  ) {
    return "It looks like you're offline or having connection issues. Please check your network and try again.";
  }

  // 2. Database Unique / Duplicate Constraints
  if (
    message.includes("duplicate key") ||
    message.includes("unique constraint") ||
    message.includes("already exists")
  ) {
    return "This record has already been added to Ensembla! No need to duplicate it.";
  }

  // 3. Database Integrity / Foreign Key Deletion Blockers
  if (
    message.includes("foreign key") ||
    message.includes("violates foreign key constraint") ||
    message.includes("check for related records")
  ) {
    return "This item cannot be deleted because it is linked to other files, credits, or companies. Please remove those links first!";
  }

  // 4. Supabase Auth / Login Errors
  if (
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials") ||
    message.includes("email or password")
  ) {
    return "Incorrect email or password. Please double-check and try again.";
  }

  if (
    message.includes("email not confirmed") ||
    message.includes("confirm your email") ||
    message.includes("email_not_confirmed")
  ) {
    return "Your email hasn't been verified yet. Please check your inbox for an activation link!";
  }

  if (message.includes("user already exists") || message.includes("email in use")) {
    return "An account with this email address already exists. Try signing in instead!";
  }

  if (message.includes("password should be")) {
    return "Your password is too short. Please use a password with at least 6 characters.";
  }

  // 5. Rate Limiting / Flooding
  if (
    status === 429 ||
    status === "429" ||
    message.includes("too many requests") ||
    message.includes("429") ||
    message.includes("rate limit")
  ) {
    return "We're processing a lot of requests right now. Please try again in a couple of hours.";
  }

  // 5.5 AI Quota / Billing limits
  if (message.includes("quota") || message.includes("billing")) {
    return "Our scanning service hit its daily limit. We'll be back tomorrow.";
  }

  // 5.6 Database COALESCE / Unmatched
  if (message.includes("coalesce") || message.includes("cannot be matched")) {
    return "Something went wrong saving this. Our team has been notified.";
  }

  // 6. Token & Authorization Expiration
  if (
    status === 401 ||
    status === "401" ||
    message.includes("jwt expired") ||
    message.includes("invalid token") ||
    message.includes("unauthorized")
  ) {
    return "Your session has expired. Please log in again to continue.";
  }

  // 7. Missing Required Columns
  if (message.includes("violates not-null constraint") || message.includes("null value")) {
    return "Please make sure to fill out all required fields before saving.";
  }

  // Fallback for standard error message if it's already semi-friendly
  if (error.message && error.message.length > 5 && error.message.length < 100 && !message.includes("constraint") && !message.includes("violates") && !message.includes("sql")) {
    return error.message;
  }

  // General elegant fallback
  return "Something went wrong. Please try again.";
}
