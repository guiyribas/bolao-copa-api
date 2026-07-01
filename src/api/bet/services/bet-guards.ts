export type ParsedScores =
  | { ok: true; homeScore: number; awayScore: number }
  | { ok: false; message: string };

/** Valida inteiros não negativos para placar do palpite. */
export function parseBetScores(homeScore: unknown, awayScore: unknown): ParsedScores {
  const h = typeof homeScore === 'number' ? homeScore : Number(homeScore);
  const a = typeof awayScore === 'number' ? awayScore : Number(awayScore);
  if (!Number.isFinite(h) || !Number.isFinite(a)) {
    return { ok: false, message: 'homeScore e awayScore devem ser números válidos.' };
  }
  if (!Number.isInteger(h) || !Number.isInteger(a)) {
    return { ok: false, message: 'homeScore e awayScore devem ser números inteiros.' };
  }
  if (h < 0 || a < 0) {
    return { ok: false, message: 'Placares não podem ser negativos.' };
  }
  return { ok: true, homeScore: h, awayScore: a };
}

export type MatchGateInput = {
  date?: string | Date | null;
  matchStatus?: string | null;
};

function parseKickoffMs(rawDate: string | Date): number | null {
  const kickoff = new Date(rawDate);
  const ms = kickoff.getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** `true` quando `now` é no instante do apito ou depois. */
export function hasKickoffPassed(
  match: Pick<MatchGateInput, 'date'>,
  now: Date = new Date()
): boolean {
  const rawDate = match.date;
  if (rawDate == null || rawDate === '') return false;
  const kickoffMs = parseKickoffMs(rawDate as string | Date);
  if (kickoffMs == null) return false;
  return now.getTime() >= kickoffMs;
}

/** Palpites de outros participantes ficam visíveis ao vivo, finalizado ou após o kickoff. */
export function arePoolMatchBetsRevealed(
  match: MatchGateInput,
  now: Date = new Date()
): boolean {
  const status = match.matchStatus ?? 'scheduled';
  if (status === 'live' || status === 'finished') return true;
  return hasKickoffPassed(match, now);
}

/** Bloqueia palpite se jogo já começou, está ao vivo ou terminou. */
export function assertMatchAcceptsBet(
  match: MatchGateInput,
  now: Date = new Date()
): { ok: true } | { ok: false; message: string } {
  const status = match.matchStatus;
  if (status === 'finished') {
    return {
      ok: false,
      message: 'Não é possível alterar o palpite após o jogo finalizado.',
    };
  }
  if (status === 'live') {
    return {
      ok: false,
      message: 'Não é possível alterar o palpite enquanto o jogo está em andamento.',
    };
  }
  const rawDate = match.date;
  if (rawDate == null || rawDate === '') {
    return { ok: false, message: 'Partida sem data agendada.' };
  }
  if (parseKickoffMs(rawDate as string | Date) == null) {
    return { ok: false, message: 'Data da partida inválida.' };
  }
  if (hasKickoffPassed(match, now)) {
    return {
      ok: false,
      message: 'Não é possível alterar o palpite após o horário de início da partida.',
    };
  }
  return { ok: true };
}

/** Só o dono do palpite pode editá-lo. */
export function assertUserIsBetOwner(
  requestUserId: number | string,
  betOwnerId: number | string | null | undefined
): { ok: true } | { ok: false; message: string } {
  if (betOwnerId == null || Number(betOwnerId) !== Number(requestUserId)) {
    return {
      ok: false,
      message: 'You can only update your own bets',
    };
  }
  return { ok: true };
}
