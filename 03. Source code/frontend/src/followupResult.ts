export function isFollowupExhausted(item: { status: string; outcome: string | null; attempt: number; max_attempts: number }) {
  return item.status === 'done' && item.outcome === 'no_response' &&
    Number.isInteger(item.attempt) && Number.isInteger(item.max_attempts) &&
    item.max_attempts > 0 && item.attempt >= item.max_attempts;
}

export function followupDeadline(completedAt: string | null | undefined, waitDays: number): string | undefined {
  if (!completedAt || !Number.isInteger(waitDays) || waitDays < 1) return;
  const deadline = Date.parse(completedAt) + waitDays * 86_400_000;
  return Number.isFinite(deadline) ? new Date(deadline).toISOString() : undefined;
}
