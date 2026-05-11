const baseUrl = (process.env.PUBLIC_URL || 'https://apibolao.guiribas.com').replace(/\/$/, '');

async function main() {
  const url = `${baseUrl}/api/matches?pagination[pageSize]=1`;
  const res = await fetch(url);

  if (!res.ok) {
    console.error(`[verify-render-api] ${res.status} ${res.statusText} — ${url}`);
    process.exit(1);
  }

  const body = await res.json();
  const total = body?.meta?.pagination?.total;

  if (typeof total !== 'number') {
    console.error('[verify-render-api] Resposta sem meta.pagination.total.');
    process.exit(1);
  }

  console.log(`[verify-render-api] OK — ${total} partida(s) em ${baseUrl}`);
}

main().catch((err) => {
  console.error('[verify-render-api]', err);
  process.exit(1);
});
