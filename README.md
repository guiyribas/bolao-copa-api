# 🚀 Getting started with Strapi

Strapi comes with a full featured [Command Line Interface](https://docs.strapi.io/dev-docs/cli) (CLI) which lets you scaffold and manage your project in seconds.

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

---

### Testes (`yarn test`)

Executa os testes unitários da pontuação (`src/api/bet/services/scoring.test.ts`). Em ambientes restritos, se `tsx` falhar por permissão de IPC, rode o comando com permissões normais de desenvolvimento.

---

## Partidas e placar (admin)

- **Palpites**: a API recusa criar ou atualizar palpite se `matchStatus` for `live` ou `finished`, ou se a hora atual for **igual ou posterior** ao campo `date` da partida (início do jogo). Alinha com a página **Regras e pontuação** no app.
- **Mata-mata**: ao lançar `homeScore` / `awayScore` no Strapi, use o **resultado final em campo** após tempo regulamentar e prorrogação (quando houver). **Pênaltis** não incrementam o placar mandante × visitante — em jogos decididos nos pênaltis, costuma gravar-se o placar ao fim da prorrogação (ex.: 1×1).

---

<sub>🤫 Psst! [Strapi is hiring](https://strapi.io/careers).</sub>
