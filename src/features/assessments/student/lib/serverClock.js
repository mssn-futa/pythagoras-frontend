/**
 * Server-anchored clock (D3: "anchors server_time/expires_at to a monotonic
 * elapsed clock"). The client wall clock is never read: elapsed time comes from
 * performance.now(), so changing the device clock cannot extend or shorten
 * the attempt. A reload fetches a fresh server_time, so it never resets time.
 */
export function createServerClock(serverTime, expiresAt, monotonic = () => performance.now(), { anchorAt, rttMs = 0 } = {}) {
  // server_time was stamped about half a round trip before it arrived, so the
  // server is already that much further along; anchor at response arrival.
  const serverStart = Date.parse(serverTime) + rttMs / 2;
  const expiry = Date.parse(expiresAt);
  const origin = anchorAt ?? monotonic();
  const valid = Number.isFinite(serverStart) && Number.isFinite(expiry);
  return {
    valid,
    /** Milliseconds left by the server's timeline, never negative. */
    remainingMs: () => (valid ? Math.max(0, expiry - (serverStart + (monotonic() - origin))) : 0),
  };
}

export function formatRemaining(ms) {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
