import type { Core } from '@strapi/strapi';

/** Janela em que a partida permanece `live` após o kickoff (`date`). */
export const MATCH_LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Atualiza `matchStatus` com base em `date` (kickoff) e no relógio do servidor.
 * Na ida para `live`, define placar 0–0 para o front não exibir placeholder vazio.
 * Ao passar para `finished` automaticamente, não sobrescreve placar (salto direto `scheduled`→`finished`
 * continua sem gols; quem passou por `live` com 0–0 mantém esse placar até alguém atualizar).
 */
export async function syncMatchStatuses(strapi: Core.Strapi): Promise<void> {
  if (process.env.SCORE_SYNC_ENABLED === 'true') {
    return;
  }

  const now = Date.now();
  const nowDate = new Date(now);
  const cutoff = new Date(now - MATCH_LIVE_WINDOW_MS);

  const uid = 'api::match.match';

  const scheduledToLive = (await strapi.documents(uid).findMany({
    filters: {
      $and: [
        { matchStatus: 'scheduled' },
        { date: { $lte: nowDate.toISOString() } },
        { date: { $gt: cutoff.toISOString() } },
      ],
    } as any,
    limit: 1000,
  })) as Array<{ documentId: string }>;

  for (const m of scheduledToLive) {
    try {
      await strapi.documents(uid).update({
        documentId: m.documentId,
        data: { matchStatus: 'live', homeScore: 0, awayScore: 0 } as any,
      });
    } catch (err) {
      strapi.log.error(
        `[match-status-sync] scheduled→live ${m.documentId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const scheduledToFinished = (await strapi.documents(uid).findMany({
    filters: {
      $and: [
        { matchStatus: 'scheduled' },
        { date: { $lte: cutoff.toISOString() } },
      ],
    } as any,
    limit: 1000,
  })) as Array<{ documentId: string }>;

  for (const m of scheduledToFinished) {
    try {
      await strapi.documents(uid).update({
        documentId: m.documentId,
        data: { matchStatus: 'finished' } as any,
      });
    } catch (err) {
      strapi.log.error(
        `[match-status-sync] scheduled→finished ${m.documentId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const liveToFinished = (await strapi.documents(uid).findMany({
    filters: {
      $and: [
        { matchStatus: 'live' },
        { date: { $lte: cutoff.toISOString() } },
      ],
    } as any,
    limit: 1000,
  })) as Array<{ documentId: string }>;

  for (const m of liveToFinished) {
    try {
      await strapi.documents(uid).update({
        documentId: m.documentId,
        data: { matchStatus: 'finished' } as any,
      });
    } catch (err) {
      strapi.log.error(
        `[match-status-sync] live→finished ${m.documentId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
