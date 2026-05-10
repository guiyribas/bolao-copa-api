import { calculatePoints } from '../../../../api/bet/services/scoring';

function pickTeamDocumentId(value: unknown): string | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    if (typeof o.documentId === 'string') {
      return o.documentId;
    }
    if (o.connect != null) {
      const raw = o.connect;
      const arr = Array.isArray(raw) ? raw : [raw];
      const first = arr[0];
      if (first != null && typeof first === 'object' && 'documentId' in first) {
        const id = (first as { documentId?: string }).documentId;
        return typeof id === 'string' ? id : undefined;
      }
      if (typeof first === 'string') {
        return first;
      }
    }
  }
  return undefined;
}

function resolveUpdateDocumentId(params: Record<string, unknown>): string | undefined {
  if (typeof params.documentId === 'string') {
    return params.documentId;
  }
  const where = params.where as Record<string, unknown> | undefined;
  if (where && typeof where.documentId === 'string') {
    return where.documentId;
  }
  return undefined;
}

async function syncMatchTitleFromRelations(
  data: Record<string, unknown>,
  existing: Record<string, unknown> | null
): Promise<void> {
  const homeSource = data.homeTeam !== undefined ? data.homeTeam : existing?.homeTeam;
  const awaySource = data.awayTeam !== undefined ? data.awayTeam : existing?.awayTeam;
  const homeId = pickTeamDocumentId(homeSource);
  const awayId = pickTeamDocumentId(awaySource);

  if (!homeId || !awayId) {
    return;
  }

  const [home, away] = await Promise.all([
    strapi.documents('api::team.team').findOne({ documentId: homeId }),
    strapi.documents('api::team.team').findOne({ documentId: awayId }),
  ]);

  const hn = home && typeof (home as { name?: string }).name === 'string' ? (home as { name: string }).name : '';
  const an = away && typeof (away as { name?: string }).name === 'string' ? (away as { name: string }).name : '';
  if (hn && an) {
    data.title = `${hn} x ${an}`;
  }
}

export default {
  async beforeCreate(event: { params: { data?: Record<string, unknown> } }) {
    const data = event.params.data;
    if (!data) {
      return;
    }
    await syncMatchTitleFromRelations(data, null);
    if (typeof data.title !== 'string' || !String(data.title).trim()) {
      const n = data.matchNumber;
      data.title = typeof n === 'number' ? `Partida ${n}` : 'Partida';
    }
  },

  async beforeUpdate(event: { params: Record<string, unknown> }) {
    const data = event.params.data as Record<string, unknown> | undefined;
    if (!data) {
      return;
    }

    // Sync de título é "best effort": nunca pode quebrar o save da partida.
    try {
      const documentId = resolveUpdateDocumentId(event.params);
      let existing: Record<string, unknown> | null = null;
      if (documentId) {
        const row = await strapi
          .documents('api::match.match')
          .findOne({ documentId, populate: { homeTeam: true, awayTeam: true } as any });
        if (row) {
          existing = row as Record<string, unknown>;
        }
      }

      await syncMatchTitleFromRelations(data, existing);
    } catch (err) {
      strapi.log.error(
        `[match.beforeUpdate] Falha no sync de title (ignorado): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  },

  async afterUpdate(event: any) {
    const { result } = event;

    if (result.matchStatus !== 'finished' || result.homeScore == null || result.awayScore == null) {
      return;
    }

    // Recalcula pontos dos bets sem deixar erro em um bet abortar o save da partida.
    try {
      const bets = (await strapi.documents('api::bet.bet').findMany({
        filters: { match: { documentId: result.documentId } } as any,
      })) as Array<{ documentId: string; homeScore: number | null; awayScore: number | null; points: number | null }>;

      for (const bet of bets) {
        if (bet.homeScore == null || bet.awayScore == null) {
          continue;
        }

        const points = calculatePoints(
          { homeScore: bet.homeScore, awayScore: bet.awayScore },
          { homeScore: result.homeScore, awayScore: result.awayScore, phase: result.phase }
        );

        if (bet.points === points) {
          continue;
        }

        try {
          await strapi.documents('api::bet.bet').update({
            documentId: bet.documentId,
            data: { points } as any,
          });
        } catch (betErr) {
          strapi.log.error(
            `[match.afterUpdate] Falha ao atualizar pontos do bet ${bet.documentId}: ${
              betErr instanceof Error ? betErr.message : String(betErr)
            }`
          );
        }
      }
    } catch (err) {
      strapi.log.error(
        `[match.afterUpdate] Falha ao recalcular pontos da partida ${result.documentId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  },
};
