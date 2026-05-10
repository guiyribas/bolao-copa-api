import type { Core } from '@strapi/strapi';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimStr(v: unknown, maxLen: number): string {
  if (v == null || typeof v !== 'string') return '';
  const t = v.trim();
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

const customPoolLead = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Criação pública de lead (pedido de bolão). Sem autenticação.
   */
  async submitPublic(ctx) {
    const raw = ctx.request.body as Record<string, unknown> | null | undefined;
    const body = raw ?? {};

    const poolName = trimStr(body.poolName, 200);
    const poolDescription = trimStr(body.poolDescription ?? body.description, 8000);
    const adminName = trimStr(body.adminName ?? body.contactName, 200);
    const adminEmailRaw = trimStr(body.adminEmail ?? body.email, 254).toLowerCase();

    let poolValue: number | undefined;
    const pv = body.poolValue ?? body.value;
    if (pv !== undefined && pv !== null && String(pv).trim() !== '') {
      const n = typeof pv === 'number' ? pv : Number.parseFloat(String(pv));
      if (!Number.isFinite(n) || n < 0) return ctx.badRequest('Valor do bolão inválido');
      poolValue = n;
    }

    if (!poolName) return ctx.badRequest('Nome do bolão é obrigatório');
    if (!adminName) return ctx.badRequest('Nome do responsável é obrigatório');
    if (!adminEmailRaw || !EMAIL_RE.test(adminEmailRaw))
      return ctx.badRequest('Email do responsável inválido');

    const created = await strapi.documents('api::pool-lead.pool-lead').create({
      data: {
        poolName,
        poolDescription: poolDescription || null,
        ...(poolValue !== undefined ? { poolValue } : {}),
        adminName,
        adminEmail: adminEmailRaw,
      },
    });

    return ctx.send({
      data: {
        id: created.documentId,
        ok: true,
      },
    });
  },
});

export default customPoolLead;
