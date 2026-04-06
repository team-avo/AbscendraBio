/**
 * Collect basic, non-sensitive device information for login audit logs.
 * Lightweight — no external libraries needed.
 */
export function getDeviceInfo(): Record<string, unknown> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { platform: "server" };
  }

  const ua = navigator.userAgent || "";

  return {
    browser: detectBrowser(ua),
    os: detectOS(ua),
    screenWidth: window.screen?.width ?? null,
    screenHeight: window.screen?.height ?? null,
    language: navigator.language || null,
    timezone: Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone || null,
    online: navigator.onLine ?? null,
  };
}

function detectBrowser(ua: string): string {
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
  if (ua.includes("Chrome/") && !ua.includes("Edg/")) return "Chrome";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
  return "Unknown";
}

function detectOS(ua: string): string {
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS")) return "macOS";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Linux")) return "Linux";
  return "Unknown";
}

// ===== Offline Login Failure Queue =====
// When a login fails due to network being offline, we queue the event in localStorage.
// When the user comes back online, we flush queued events to the server.

const QUEUE_KEY = "login_failure_queue";

interface QueuedLoginEvent {
  email: string;
  portal: string;
  failureReason: string;
  failureDetail?: string;
  deviceInfo?: Record<string, unknown>;
  timestamp: string;
}

export function queueLoginFailure(event: QueuedLoginEvent): void {
  try {
    const existing = JSON.parse(
      localStorage.getItem(QUEUE_KEY) || "[]",
    ) as QueuedLoginEvent[];
    // Cap at 50 queued events to prevent storage abuse
    if (existing.length >= 50) existing.shift();
    existing.push(event);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
  } catch {
    // localStorage not available — silently ignore
  }
}

export function getQueuedLoginFailures(): QueuedLoginEvent[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearLoginFailureQueue(): void {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch {
    // silently ignore
  }
}
