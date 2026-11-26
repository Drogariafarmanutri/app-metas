# Monitor BotVendas (subpasta do app-metas)

App de celular (PWA) que acompanha a fila de atendimento do BotVendas, com alarme sonoro e desempenho dos vendedores.

- **App:** esta pasta (`monitor/`), publicada pelo GitHub Pages em `.../app-metas/monitor/`.
- **Servidor intermediário:** `supabase/functions/bv-proxy/` (Edge Function do projeto Supabase). O BotVendas só aceita
  CORS do próprio site, então o app fala com a função e ela repassa ao BotVendas. Só leitura (GET) e login.
- **Entrada no app:** e-mail e senha do usuário de API do BotVendas (Lojas > Integrações > Credenciais API).

## Publicação
1. **Pages:** o app-metas já é publicado pelo GitHub Pages; ao fazer o merge, `/monitor/` fica no ar junto.
2. **Supabase:** Settings > Integrations > GitHub > conectar o repositório `app-metas`, pasta `supabase`,
   branch de produção `main`, com "Deploy to production" ligado. A função `bv-proxy` é publicada a cada merge.
3. Se o endereço do Pages não for `https://drogariafarmanutri.github.io`, defina o segredo `ALLOWED_ORIGINS`
   da função (Edge Functions > bv-proxy > Secrets) com o endereço certo.

## Instalar no celular
Abra `.../app-metas/monitor/` no Chrome/Safari > menu > Adicionar à tela inicial. Em Ajustes, toque em "Testar alarme".

## Como o tempo de espera é calculado
É o tempo desde a última atualização do atendimento em "Aguardando vendedor" (`updated_at`, que o BotVendas envia em horário de Brasília). O campo `te_in_seconds` não é usado porque fica parado. Uma única chamada por leitura (intervalo mínimo de 30 s), porque o BotVendas limita requisições por minuto (erro 429).

## Limites
- Se o BotVendas atualizar `updated_at` durante a espera (por exemplo, nova mensagem do cliente), o contador pode recomeçar.
- O alarme toca com o app aberto e a tela ligada. Com o celular bloqueado o navegador não toca som.
- A senha do usuário de API fica salva só neste aparelho, para reconectar quando o acesso expirar.

## Testes
`supabase/functions/bv-proxy/index.test.ts` (Deno): `deno test --allow-net --allow-env --allow-read index.test.ts`
