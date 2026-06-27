# 🚀 Getting started with Strapi

Strapi comes with a full featured [Command Line Interface](https://docs.strapi.io/dev-docs/cli) (CLI) which lets you scaffold and manage your project in seconds.

### Desenvolvimento local com PostgreSQL no Docker

Com Docker e Docker Compose disponíveis:

```bash
yarn dev:docker
```

Esse comando sobe o PostgreSQL, aguarda o healthcheck e inicia o Strapi. Comandos úteis:

```bash
yarn db:up     # sobe somente o PostgreSQL
yarn db:logs   # acompanha os logs do PostgreSQL
yarn db:down   # para e remove o container, preservando os dados
yarn db:reset  # remove também o volume e todos os dados locais
```

### `develop`

Start your Strapi application with autoReload enabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-develop)

```
npm run develop
# or
yarn develop
```

### `start`

Start your Strapi application with autoReload disabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-start)

```
npm run start
# or
yarn start
```

### `build`

Build your admin panel. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-build)

```
npm run build
# or
yarn build
```

## ⚙️ Deployment

Strapi gives you many possible deployment options for your project including [Strapi Cloud](https://cloud.strapi.io). Browse the [deployment section of the documentation](https://docs.strapi.io/dev-docs/deployment) to find the best solution for your use case.

```
yarn strapi deploy
```

## 📚 Learn more

- [Resource center](https://strapi.io/resource-center) - Strapi resource center.
- [Strapi documentation](https://docs.strapi.io) - Official Strapi documentation.
- [Strapi tutorials](https://strapi.io/tutorials) - List of tutorials made by the core team and the community.
- [Strapi blog](https://strapi.io/blog) - Official Strapi blog containing articles made by the Strapi team and the community.
- [Changelog](https://strapi.io/changelog) - Find out about the Strapi product updates, new features and general improvements.

Feel free to check out the [Strapi GitHub repository](https://github.com/strapi/strapi). Your feedback and contributions are welcome!

## ✨ Community

- [Discord](https://discord.strapi.io) - Come chat with the Strapi community including the core team.
- [Forum](https://forum.strapi.io/) - Place to discuss, ask questions and find answers, show your Strapi project and get feedback or just talk with other Community members.
- [Awesome Strapi](https://github.com/strapi/awesome-strapi) - A curated list of awesome things related to Strapi.

---

## Users & Permissions (convite / join)

Confira no **Strapi Admin** se as permissões do plugin **Users & Permissions** estão corretas:

- **Public**: habilite **find** em **Pool** (para o app resolver o bolão pelo `inviteCode` sem login). O perfil público em `/user/[username]` usa `GET /api/bets/by-username/:username/public` com `auth: false` no código; se em algum ambiente ainda aparecer **403**, verifique no role **Public** se existe permissão explícita para o handler customizado **publicBetsByUsername** / rota **bet** (Strapi 5 lista rotas customizadas no Admin em **Settings → Users & Permissions → Roles**). Para **bandeiras** no perfil sem login, o Next também tenta `GET /api/matches` com `populate` de `flag`: no role **Public**, habilite **find** em **Match** e **Team** (e permissão de leitura em **Upload** / ficheiros de media, conforme o teu plugin), senão o segundo pedido falha silenciosamente e só contam os dados já normalizados no endpoint de apostas.
- **Authenticated**: habilite em **Pool** as ações **join** (`POST /api/pools/join`), **myMemberships** (`GET /api/pools/mine/memberships`; evita `filters[user]` no REST, que o Strapi 5 rejeita), **poolSession** (`GET /api/pools/:id/session` — dados do bolão para o utilizador logado e flag **isAdmin** calculada no servidor; o layout da app usa este endpoint em vez do REST genérico com `populate[admin]`), **members** (`GET /api/pools/:id/members`), **updatePayment** (`PATCH /api/pools/:id/members/:userId/payment`), **removeMember** (`DELETE /api/pools/:id/members/:userId`, para o criador do bolão remover um participante) e **updatePoolSettings** (`PATCH /api/pools/:id/settings`, para o criador do bolão alterar nome, descrição e valor por participante). Mantenha **find** em **pool-memberships** se precisar de outros endpoints desse tipo.

Sem isso, o convite pode falhar com 403/401 mesmo após corrigir o código.

### Tela de palpites (`/palpites`)

Os palpites são **globais** (um por partida por usuário). Se `GET /api/matches`, `GET /api/bets/my-bets` ou `GET /api/bets/group-simulation` aparecerem em vermelho no Network (geralmente **403**), no role **Authenticated** habilite:

| Content-type | Permissões |
|--------------|------------|
| **Match** | **find** |
| **Team** | **find** (necessário para `populate` de `homeTeam` / `awayTeam` nas partidas) |
| **Bet** | **create** (salvar palpite), **my-bets** (`GET /api/bets/my-bets`) e **group-simulation** (`GET /api/bets/group-simulation`) |

No dev, o React pode disparar cada request **duas vezes** (Strict Mode); não é falha extra da API.

### Fase atual do torneio (`currentPhase`)

O single type **Configuração do torneio** (`tournament-config`) guarda a fase em que a Copa está. O bootstrap cria o registro com `currentPhase: group` se ainda não existir.

**Alterar manualmente:** Strapi Admin → Content Manager → **Configuração do torneio** → campo **Fase atual** → Save.

Valores possíveis (mesmo enum de `match.phase`):

| Valor | Significado |
|-------|-------------|
| `group` | Fase de grupos |
| `round_of_32` | Segunda fase |
| `round_of_16` | Oitavas |
| `quarter` | Quartas |
| `semi` | Semi |
| `third_place` | 3º lugar |
| `final` | Final |

**Endpoint público:** `GET /api/tournament/current-phase` → `{ "currentPhase": "group" }`.

**Efeito no frontend:** enquanto `currentPhase` for `group`, `/palpites` mantém o comportamento atual (aba **Todas** por padrão). A partir da segunda fase (`round_of_32` em diante), ao abrir `/palpites` sem `?phase=` na URL, o app redireciona para a aba correspondente. Se o usuário escolher outra aba manualmente (`?phase=...`), a URL é respeitada.

---

### Testes (`yarn test`)

Executa os testes unitários da pontuação (`src/api/bet/services/scoring.test.ts`). Em ambientes restritos, se `tsx` falhar por permissão de IPC, rode o comando com permissões normais de desenvolvimento.

---

## Sincronização de placares

A integração permite escolher um provedor de placares por ambiente. Apenas um provedor fica ativo por vez,
evitando que duas fontes sobrescrevam o mesmo jogo.

Configure o seletor no `.env`:

```env
SCORE_PROVIDER=football-data
SCORE_SYNC_ENABLED=false
```

Valores aceitos para `SCORE_PROVIDER`:

- `football-data`: API estabelecida, exige token e pode atrasar placares no plano gratuito.
- `worldcup26`: API comunitária gratuita, sem token e com promessa de placares em tempo real.

Configuração do `football-data`:

```env
FOOTBALL_DATA_API_KEY=sua-chave
FOOTBALL_DATA_API_URL=https://api.football-data.org/v4
FOOTBALL_DATA_COMPETITION=WC
FOOTBALL_DATA_SEASON=2026
FOOTBALL_DATA_TIMEOUT_MS=15000
FOOTBALL_DATA_CRON=
```

Configuração do `worldcup26`:

```env
WORLDCUP26_API_URL=https://worldcup26.ir
WORLDCUP26_TIMEOUT_MS=15000
WORLDCUP26_CRON=
```

Teste manualmente antes de habilitar o cron:

```bash
yarn sync:scores
```

O comando compila o projeto antes da sincronização para evitar incompatibilidades entre o runner `tsx`
e dependências CommonJS usadas internamente pelo Strapi.

O `football-data` vincula partidas pelo horário e pelos códigos das seleções, salvando seu identificador
em `externalId`. O `worldcup26` usa diretamente o `matchNumber` de `1` a `104` e não altera o vínculo do
outro provedor.

Com `SCORE_SYNC_ENABLED=true`, o cron consulta `football-data` a cada 15 minutos ou `worldcup26` a cada
3 minutos, conforme o provedor selecionado. Atualizações com status `finished` disparam o lifecycle existente
e recalculam os pontos dos palpites.

As variáveis `FOOTBALL_DATA_CRON` e `WORLDCUP26_CRON` aceitam expressões cron com segundos. Quando vazias,
usam os intervalos padrão acima. Exemplo para consultar `worldcup26` a cada minuto:

```env
WORLDCUP26_CRON=0 * * * * *
```

Ao usar `football-data`, o provedor exige a atribuição visível `Data provided by football-data.org` no app/site.

---

## Partidas e placar (admin)

- **Palpites**: a API recusa criar ou atualizar palpite se `matchStatus` for `live` ou `finished`, ou se a hora atual for **igual ou posterior** ao campo `date` da partida (início do jogo). Alinha com a página **Regras e pontuação** no app.
- **Mata-mata**: ao lançar `homeScore` / `awayScore` no Strapi, use o **resultado final em campo** após tempo regulamentar e prorrogação (quando houver). **Pênaltis** não incrementam o placar mandante × visitante — em jogos decididos nos pênaltis, costuma gravar-se o placar ao fim da prorrogação (ex.: 1×1).

---

<sub>🤫 Psst! [Strapi is hiring](https://strapi.io/careers).</sub>
