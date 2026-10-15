/** Only allows same-origin relative paths to avoid open redirects. */
export function safeRedirect(value: string | null, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

export const CHATBOT_REDIRECT = '/?chatbot=1';
