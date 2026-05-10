import type { Core } from '@strapi/strapi';

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
      populate: ['pool'],
    });

    return ctx.send({ data: memberships });
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

    const memberships = await strapi.documents('api::pool-membership.pool-membership').findMany({
      filters: { pool: { documentId: id } },
      populate: ['user'],
    });

    const rankingMap: Record<string, { userId: string; username: string; points: number }> = {};

    for (const m of memberships as any[]) {
      const u = m.user;
      if (!u?.id) continue;
      const key = String(u.id);
      rankingMap[key] = {
        userId: String(u.id),
        username: u.username || String(u.id),
        points: 0,
      };
    }

    const memberIds = Object.keys(rankingMap).map((k) => Number(k));

    if (memberIds.length > 0) {
      const bets = await strapi.documents('api::bet.bet').findMany({
        filters: {
          $or: memberIds.map((memberId) => ({ user: { id: memberId } })),
        } as any,
        populate: ['user'],
      });

      for (const bet of bets as any[]) {
        if (!bet.user?.id) continue;
        const key = String(bet.user.id);
        if (!rankingMap[key]) continue;
        rankingMap[key].points += bet.points || 0;
      }
    }

    const ranking = Object.values(rankingMap).sort((a, b) => b.points - a.points);

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
});

export default customPool;
