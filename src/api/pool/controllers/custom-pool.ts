import type { Core } from '@strapi/strapi';

import { isExactScorePoints, isKnockoutPhase } from '../../bet/services/scoring';

type AdminLike = { id?: number | string; documentId?: string } | null;

function isPoolAdmin(
  pool: { admin?: AdminLike },
  user: { id?: number | string; documentId?: string } | null | undefined
): boolean {
  if (!user) return false;
  const a = pool.admin;
  if (!a) return false;
  if (a.id != null && user.id != null && Number(a.id) === Number(user.id)) {
    return true;
  }
  if (a.documentId && user.documentId && a.documentId === user.documentId) {
    return true;
  }
  return false;
}

/** JWT pode não trazer `documentId`; alinha com o utilizador em BD para comparar com `pool.admin`. */
async function resolveUsersPermissionsUser(
  strapi: Core.Strapi,
  user: { id?: number | string; documentId?: string }
): Promise<{ id?: number | string; documentId?: string }> {
  let documentId = user.documentId as string | undefined;
  if (!documentId && user.id != null) {
    const found = await strapi.documents('plugin::users-permissions.user').findMany({
      filters: { id: user.id },
      limit: 1,
    });
    documentId = found[0]?.documentId;
  }
  return { ...user, documentId };
}

type PoolRankRow = {
  userId: string;
  username: string;
  points: number;
  pointsGroupPhase: number;
  pointsKnockout: number;
  exactHitCount: number;
};

async function computePoolRanking(
  strapi: Core.Strapi,
  poolDocumentId: string
): Promise<PoolRankRow[]> {
  const memberships = await strapi.documents('api::pool-membership.pool-membership').findMany({
    filters: { pool: { documentId: poolDocumentId } },
    populate: ['user'],
  });

  const rankingMap: Record<string, PoolRankRow> = {};

  for (const m of memberships as any[]) {
    const u = m.user;
    if (!u?.id) continue;
    const key = String(u.id);
    rankingMap[key] = {
      userId: String(u.id),
      username: u.username || String(u.id),
      points: 0,
      pointsGroupPhase: 0,
      pointsKnockout: 0,
      exactHitCount: 0,
    };
  }

  const memberIds = Object.keys(rankingMap).map((k) => Number(k));

  if (memberIds.length > 0) {
    const bets = await strapi.documents('api::bet.bet').findMany({
      filters: {
        user: { id: { $in: memberIds } },
      } as any,
      populate: ['user', 'match'],
    });

    for (const bet of bets as any[]) {
      if (!bet.user?.id) continue;
      const key = String(bet.user.id);
      if (!rankingMap[key]) continue;
      const pts = bet.points || 0;
      rankingMap[key].points += pts;
      const phase = bet.match?.phase as string | undefined;
      if (isKnockoutPhase(phase)) {
        rankingMap[key].pointsKnockout += pts;
      } else {
        rankingMap[key].pointsGroupPhase += pts;
      }
      if (isExactScorePoints(phase, pts)) {
        rankingMap[key].exactHitCount += 1;
      }
    }
  }

  return Object.values(rankingMap).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.exactHitCount !== a.exactHitCount) return b.exactHitCount - a.exactHitCount;
    return a.username.localeCompare(b.username, 'pt-BR');
  });
}

const customPool = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Lista memberships do usuário logado. O REST genérico não aceita
   * `filters[user]` (ValidationError: Invalid key user) em Strapi 5.
   */
  async myMemberships(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    let userDocumentId = user.documentId as string | undefined;
    if (!userDocumentId && user.id != null) {
      const found = await strapi.documents('plugin::users-permissions.user').findMany({
        filters: { id: user.id },
        limit: 1,
      });
      userDocumentId = found[0]?.documentId;
    }

    if (!userDocumentId) {
      return ctx.badRequest('Could not resolve user');
    }

    const memberships = await strapi.documents('api::pool-membership.pool-membership').findMany({
      filters: {
        user: { documentId: userDocumentId },
      },
      populate: ['pool', 'user'],
    });

    const populatedUserId = (memberships[0] as { user?: { id?: number } } | undefined)?.user?.id;
    let viewerIdStr: string | null =
      populatedUserId != null ? String(populatedUserId) : user.id != null ? String(user.id) : null;
    if (viewerIdStr == null && userDocumentId) {
      const fu = await strapi.documents('plugin::users-permissions.user').findMany({
        filters: { documentId: userDocumentId },
        limit: 1,
      });
      viewerIdStr = fu[0]?.id != null ? String(fu[0].id) : null;
    }

    const poolDocumentIds = [
      ...new Set(
        (memberships as { pool?: { documentId?: string } }[])
          .map((m) => m.pool?.documentId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      ),
    ];

    const rankings = await Promise.all(
      poolDocumentIds.map(async (pid) => [pid, await computePoolRanking(strapi, pid)] as const)
    );
    const rankingByPool = new Map<string, PoolRankRow[]>(rankings);

    const data = (memberships as any[]).map((m) => {
      const pid = m.pool?.documentId as string | undefined;
      const ranking = pid ? rankingByPool.get(pid) ?? [] : [];
      const idx =
        viewerIdStr != null ? ranking.findIndex((r) => r.userId === viewerIdStr) : -1;
      return {
        ...m,
        rankingPlace: idx >= 0 ? idx + 1 : null,
        rankingTotal: ranking.length,
      };
    });

    return ctx.send({ data });
  },

  async join(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const inviteCode = ctx.params.inviteCode || ctx.request.body?.inviteCode;
    if (!inviteCode) {
      return ctx.badRequest('inviteCode is required');
    }

    const pools = await strapi.documents('api::pool.pool').findMany({
      filters: { inviteCode },
    });

    if (!pools.length) {
      return ctx.notFound('Pool not found with this invite code');
    }

    const pool = pools[0];

    const existingMembership = await strapi.documents('api::pool-membership.pool-membership').findMany({
      filters: {
        pool: { documentId: pool.documentId },
        user: { documentId: user.documentId },
      },
    });

    if (existingMembership.length > 0) {
      return ctx.badRequest('You are already a member of this pool');
    }

    const membership = await strapi.documents('api::pool-membership.pool-membership').create({
      data: {
        pool: pool.documentId,
        user: user.documentId,
        hasPaid: false,
        joinedAt: new Date().toISOString(),
      },
    });

    return ctx.send({ data: membership });
  },

  async ranking(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { id } = ctx.params;
    const ranking = await computePoolRanking(strapi, id);
    return ctx.send({ data: ranking });
  },

  async members(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { id } = ctx.params;

    const pool = await strapi.documents('api::pool.pool').findOne({
      documentId: id,
      populate: ['admin'],
    });

    if (!pool) {
      return ctx.notFound('Pool not found');
    }

    const resolvedUser = await resolveUsersPermissionsUser(strapi, user);
    if (!isPoolAdmin(pool, resolvedUser)) {
      return ctx.forbidden('Only the pool admin can view members');
    }

    const memberships = await strapi.documents('api::pool-membership.pool-membership').findMany({
      filters: { pool: { documentId: id } },
      populate: ['user'],
    });

    const members = memberships.map((m) => ({
      id: m.user?.id,
      userDocumentId: m.user?.documentId,
      username: m.user?.username,
      email: m.user?.email,
      hasPaid: m.hasPaid,
      joinedAt: m.joinedAt,
      membershipId: m.documentId,
    }));

    return ctx.send({ data: members });
  },

  async updatePayment(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { id, userId } = ctx.params;
    const { hasPaid } = ctx.request.body;

    const pool = await strapi.documents('api::pool.pool').findOne({
      documentId: id,
      populate: ['admin'],
    });

    if (!pool) {
      return ctx.notFound('Pool not found');
    }

    const resolvedUser = await resolveUsersPermissionsUser(strapi, user);
    if (!isPoolAdmin(pool, resolvedUser)) {
      return ctx.forbidden('Only the pool admin can update payment status');
    }

    const memberships = await strapi.documents('api::pool-membership.pool-membership').findMany({
      filters: {
        pool: { documentId: id },
        user: { documentId: userId },
      },
    });

    if (!memberships.length) {
      return ctx.notFound('Membership not found');
    }

    const updated = await strapi.documents('api::pool-membership.pool-membership').update({
      documentId: memberships[0].documentId,
      data: { hasPaid: Boolean(hasPaid) } as any,
    });

    return ctx.send({ data: updated });
  },

  async removeMember(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { id, userId } = ctx.params;

    const pool = await strapi.documents('api::pool.pool').findOne({
      documentId: id,
      populate: ['admin'],
    });

    if (!pool) {
      return ctx.notFound('Pool not found');
    }

    const resolvedUser = await resolveUsersPermissionsUser(strapi, user);
    if (!isPoolAdmin(pool, resolvedUser)) {
      return ctx.forbidden('Only the pool admin can remove members');
    }

    const admin = pool.admin as AdminLike;
    if (
      (admin?.documentId && admin.documentId === userId) ||
      (admin?.id != null &&
        userId != null &&
        !Number.isNaN(Number(userId)) &&
        Number(admin.id) === Number(userId))
    ) {
      return ctx.badRequest('The pool admin cannot be removed from the pool');
    }

    const memberships = await strapi.documents('api::pool-membership.pool-membership').findMany({
      filters: {
        pool: { documentId: id },
        user: { documentId: userId },
      },
    });

    if (!memberships.length) {
      return ctx.notFound('Membership not found');
    }

    await strapi.documents('api::pool-membership.pool-membership').delete({
      documentId: memberships[0].documentId,
    });

    return ctx.send({ data: { removed: true } });
  },

  async updatePoolSettings(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { id } = ctx.params;
    const body = ctx.request.body as {
      name?: unknown;
      description?: unknown;
      value?: unknown;
    };

    const pool = await strapi.documents('api::pool.pool').findOne({
      documentId: id,
      populate: ['admin'],
    });

    if (!pool) {
      return ctx.notFound('Pool not found');
    }

    const resolvedUser = await resolveUsersPermissionsUser(strapi, user);
    if (!isPoolAdmin(pool, resolvedUser)) {
      return ctx.forbidden('Only the pool admin can update pool settings');
    }

    const data: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        return ctx.badRequest('Pool name is required when provided');
      }
      data.name = body.name.trim();
    }
    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      if (body.description === null || body.description === undefined) {
        data.description = null;
      } else if (typeof body.description === 'string') {
        data.description = body.description;
      } else {
        return ctx.badRequest('Invalid description');
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, 'value')) {
      const raw = body.value;
      const num =
        typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
      if (Number.isNaN(num) || num < 0) {
        return ctx.badRequest('A valid non-negative pool value is required when provided');
      }
      data.value = num;
    }

    if (Object.keys(data).length === 0) {
      return ctx.badRequest('No updatable fields provided');
    }

    const updated = await strapi.documents('api::pool.pool').update({
      documentId: id,
      data: data as any,
    });

    return ctx.send({ data: updated });
  },

  /**
   * Dados do bolão para a sessão atual + `isAdmin` calculado no servidor.
   * Evita depender do populate REST do `admin` (permissões do plugin User podem omitir a relação na UI).
   */
  async poolSession(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const { id } = ctx.params;

    const pool = await strapi.documents('api::pool.pool').findOne({
      documentId: id,
      populate: ['admin'],
    });

    if (!pool) {
      return ctx.notFound('Pool not found');
    }

    const resolvedUser = await resolveUsersPermissionsUser(strapi, user);
    const isAdmin = isPoolAdmin(pool, resolvedUser);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteLink = pool.inviteCode
      ? `${frontendUrl}/invite/${pool.inviteCode}`
      : null;

    const rawAdmin = pool.admin as {
      id?: number | string;
      documentId?: string;
      username?: string;
      email?: string;
    } | null;

    const idNum = (v: unknown) => {
      if (v == null) return 0;
      const n = Number(v);
      return Number.isNaN(n) ? 0 : n;
    };

    const valueRaw = pool.value;
    const valueNum =
      typeof valueRaw === 'number'
        ? valueRaw
        : typeof valueRaw === 'string'
          ? Number(valueRaw)
          : 0;

    const admin =
      rawAdmin != null
        ? {
            id: idNum(rawAdmin.id),
            documentId: rawAdmin.documentId,
            username: rawAdmin.username ?? '',
            email: rawAdmin.email ?? '',
          }
        : undefined;

    const memberships = await strapi
      .documents('api::pool-membership.pool-membership')
      .findMany({
        filters: { pool: { documentId: id } },
        fields: ['hasPaid'],
      });

    const memberCount = memberships.length;
    const paidCount = memberships.filter((m) => Boolean(m.hasPaid)).length;
    const safeValue = Number.isNaN(valueNum) ? 0 : valueNum;
    const totalCollected = paidCount * safeValue;

    return ctx.send({
      data: {
        documentId: pool.documentId,
        name: pool.name,
        description: pool.description ?? '',
        value: safeValue,
        inviteCode: pool.inviteCode ?? '',
        inviteLink,
        admin,
        isAdmin,
        memberCount,
        paidCount,
        totalCollected,
      },
    });
  },

  /**
   * Palpites na partida agrupados por bolão em que o utilizador participa.
   * Palpites de outros membros só são revelados com partida ao vivo ou finalizada;
   * o próprio utilizador vê sempre o seu palpite.
   */
  async poolMatchBets(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const matchDocumentId = ctx.params.matchDocumentId as string | undefined;
    if (!matchDocumentId || String(matchDocumentId).trim() === '') {
      return ctx.badRequest('matchDocumentId is required');
    }

    const match = await strapi.documents('api::match.match').findOne({
      documentId: matchDocumentId,
    });

    if (!match) {
      return ctx.notFound('Match not found');
    }

    const statusRaw = (match as { matchStatus?: string }).matchStatus;
    const revealed = statusRaw === 'live' || statusRaw === 'finished';

    let userDocumentId = user.documentId as string | undefined;
    if (!userDocumentId && user.id != null) {
      const found = await strapi.documents('plugin::users-permissions.user').findMany({
        filters: { id: user.id },
        limit: 1,
      });
      userDocumentId = found[0]?.documentId;
    }

    if (!userDocumentId) {
      return ctx.badRequest('Could not resolve user');
    }

    const viewerIdStr = user.id != null ? String(user.id) : '';

    const myMemberships = await strapi.documents('api::pool-membership.pool-membership').findMany({
      filters: {
        user: { documentId: userDocumentId },
      },
      populate: ['pool'],
    });

    type MembershipRow = {
      pool?: { documentId?: string; name?: string };
    };

    const poolDocIds = [
      ...new Set(
        (myMemberships as MembershipRow[])
          .map((m) => m.pool?.documentId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      ),
    ];

    const membersByPool = new Map<
      string,
      Array<{ id: string; username: string }>
    >();

    const allMemberNumericIds = new Set<number>();

    for (const poolDocId of poolDocIds) {
      const mems = await strapi.documents('api::pool-membership.pool-membership').findMany({
        filters: { pool: { documentId: poolDocId } },
        populate: ['user'],
      });

      const rows: Array<{ id: string; username: string }> = [];
      for (const row of mems as any[]) {
        const u = row.user;
        const uid = u?.id;
        if (uid == null) continue;
        const idStr = String(uid);
        rows.push({
          id: idStr,
          username: typeof u.username === 'string' && u.username.trim() !== '' ? u.username : idStr,
        });
        allMemberNumericIds.add(Number(uid));
      }
      rows.sort((a, b) => a.username.localeCompare(b.username, 'pt'));
      membersByPool.set(poolDocId, rows);
    }

    const betsByUserId = new Map<
      string,
      { homeScore: number; awayScore: number; points: number | null }
    >();

    const memberIdArray = [...allMemberNumericIds];
    if (memberIdArray.length > 0) {
      const bets = await strapi.documents('api::bet.bet').findMany({
        filters: {
          match: { documentId: matchDocumentId },
          user: { id: { $in: memberIdArray } },
        } as any,
        populate: ['user'],
      });

      for (const bet of bets as any[]) {
        const uid = bet.user?.id;
        if (uid == null) continue;
        const key = String(uid);
        betsByUserId.set(key, {
          homeScore: bet.homeScore,
          awayScore: bet.awayScore,
          points: bet.points ?? null,
        });
      }
    }

    const poolsOut: Array<{
      poolDocumentId: string;
      poolName: string;
      entries: Array<{
        userId: string;
        username: string;
        homeScore: number | null;
        awayScore: number | null;
        points: number | null;
        hasBet: boolean;
        isViewer: boolean;
      }>;
    }> = [];

    const seenPoolIds = new Set<string>();

    for (const m of myMemberships as MembershipRow[]) {
      const pool = m.pool;
      const poolDocId = pool?.documentId;
      if (!poolDocId || seenPoolIds.has(poolDocId)) continue;
      seenPoolIds.add(poolDocId);

      const members = membersByPool.get(poolDocId) ?? [];

      const entries = members.map((mem) => {
        const isViewer = viewerIdStr !== '' && mem.id === viewerIdStr;
        const showScores = revealed || isViewer;
        const bet = betsByUserId.get(mem.id);
        const hasBetRaw = Boolean(bet);
        /** Não revelar se outros já palpitaram antes da partida começar. */
        const hasBet = hasBetRaw && (isViewer || revealed);

        return {
          userId: mem.id,
          username: mem.username,
          homeScore: showScores ? (bet?.homeScore ?? null) : null,
          awayScore: showScores ? (bet?.awayScore ?? null) : null,
          points: showScores ? (bet?.points ?? null) : null,
          hasBet,
          isViewer,
        };
      });

      poolsOut.push({
        poolDocumentId: poolDocId,
        poolName: typeof pool?.name === 'string' ? pool.name : 'Bolão',
        entries,
      });
    }

    return ctx.send({
      data: {
        matchDocumentId,
        matchStatus: statusRaw ?? 'scheduled',
        revealed,
        pools: poolsOut,
      },
    });
  },
});

export default customPool;
