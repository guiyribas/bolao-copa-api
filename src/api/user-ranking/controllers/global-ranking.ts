import type { Core } from '@strapi/strapi';

type RankingRow = {
  user?: { id?: number | string; username?: string } | null;
  totalPoints?: number | null;
  groupPhasePoints?: number | null;
  knockoutPoints?: number | null;
  exactHitCount?: number | null;
};

function parsePositiveInt(raw: unknown, fallback: number, max: number): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

const globalRanking = ({ strapi }: { strapi: Core.Strapi }) => ({
  async list(ctx) {
    const page = parsePositiveInt(ctx.query.page, 1, Number.MAX_SAFE_INTEGER);
    const pageSize = parsePositiveInt(ctx.query.pageSize, 50, 100);

    const rows = (await strapi.documents('api::user-ranking.user-ranking').findMany({
      populate: ['user'],
    })) as RankingRow[];

    const sorted = rows
      .map((row) => {
        const userId = row.user?.id;
        const username =
          typeof row.user?.username === 'string' && row.user.username.trim() !== ''
            ? row.user.username
            : userId != null
              ? String(userId)
              : '';

        return {
          userId: userId != null ? String(userId) : '',
          username,
          points: row.totalPoints ?? 0,
          pointsGroupPhase: row.groupPhasePoints ?? 0,
          pointsKnockout: row.knockoutPoints ?? 0,
          exactHitCount: row.exactHitCount ?? 0,
        };
      })
      .filter((row) => row.userId !== '')
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.exactHitCount !== a.exactHitCount) return b.exactHitCount - a.exactHitCount;
        return a.username.localeCompare(b.username, 'pt-BR');
      })
      .map(({ exactHitCount: _exactHitCount, ...entry }) => entry);

    const total = sorted.length;
    const start = (page - 1) * pageSize;
    const data = sorted.slice(start, start + pageSize);

    return ctx.send({
      data,
      meta: {
        page,
        pageSize,
        total,
        pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    });
  },
});

export default globalRanking;
