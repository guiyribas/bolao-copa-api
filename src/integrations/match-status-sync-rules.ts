type MatchStatus = 'scheduled' | 'live' | 'finished';

export function resolveSyncedMatchStatus(
  local: MatchStatus | null | undefined,
  remote: MatchStatus
): MatchStatus {
  const current = local ?? 'scheduled';
  if (current === remote) return current;
  if (current === 'live' && remote === 'scheduled') return 'live';
  if (current === 'finished') return 'finished';
  return remote;
}

export function shouldApplyRemoteScores(
  local: MatchStatus | null | undefined
): boolean {
  return (local ?? 'scheduled') !== 'finished';
}
