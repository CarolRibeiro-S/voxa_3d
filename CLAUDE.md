@AGENTS.md

# Voxa3D

SaaS multi-tenant de gestão para negócios de impressão 3D (FDM e resina). Domínio: voxa3d.com.br.
Repositório: https://github.com/CarolRibeiro-S/voxa_3d.git

## Planos

Existem só dois planos: Pro e Loja. A calculadora faz parte dos dois. Preços, períodos (mensal, trimestral, semestral, anual) e descontos NÃO ficam no código: vêm do banco (`plans`, `plan_periods`, `launch_config`, `coupons`) e o cálculo roda só no servidor (`src/lib/billing/plans.ts`, em centavos).

| Plano | Para quem | Features |
| --- | --- | --- |
| Pro | 1 usuário | calculator, quotes, orders, finance, sales_reports, stock, maintenance, channels |
| Loja | vários usuários com permissão por aba | tudo do Pro, mais multi_user e public_quote |

Todo cadastro novo começa com teste grátis de 7 dias (sem cartão) no plano Pro, controlado pela tabela `subscriptions`. Depois do teste sem assinatura ativa a conta entra em modo leitura: vê os dados, não cria nem edita nada (nunca apagar dados). O bloqueio é feito no servidor (`writeBlockedMessage` em `src/lib/billing/guard.ts`), todo Server Action que grava deve chamá-lo.

Fonte da verdade dos recursos: `src/lib/plans.ts` (`hasFeature(plan, feature)`). O plano efetivo vem da assinatura via `getCurrentTenant()` em `src/lib/tenant.ts`. Itens da sidebar que o plano não inclui aparecem com cadeado (Lock), sem esconder o item.

## Fases

**Fase 1**
- Login e multi-tenant
- Catálogo de pelo menos 15 impressoras
- Materiais
- Configurações de custo
- Calculadoras FDM e resina
- Orçamentos salvos com PDF ou link
- Kanban de pedidos (pedido feito, imprimindo, pronto, enviado, entregue)
- Controle de plano

**Fase 2**
- Financeiro
- Vendas e relatórios
- Estoque
- Manutenção
- Vários usuários com permissão por aba
- Orçamento online

## Stack

- Next.js (App Router) com TypeScript estrito, pasta `src/` e alias `@/*`
- Tailwind CSS v4 (tokens em `@theme` no `src/app/globals.css`)
- Supabase: `@supabase/supabase-js` e `@supabase/ssr` (Auth por e-mail e senha, cookies com getAll e setAll)
- Zod, React Hook Form e `@hookform/resolvers` nos formulários
- lucide-react, clsx e tailwind-merge (`cn()` em `src/lib/utils.ts`)
- Fonte Sora via `next/font/google`
- Gerenciador de pacotes: npm

Nota: no Next.js 16 o arquivo `middleware.ts` foi renomeado para `proxy.ts`. O proxy está em `src/proxy.ts` e usa `src/lib/supabase/middleware.ts` (`updateSession`).

## Design tokens

- violeta `#6D3BFF` (principal), violeta-escuro `#4A22C9` (hover)
- tinta `#12091F` (texto e fundo escuro)
- limão `#C6F432` (destaque, somente sobre fundo escuro)
- névoa `#F5F3FF` (fundo claro)

Mobile first, `rounded-xl`, sombras suaves.

## Convenções

- Identificadores técnicos em inglês. Rotas e textos da interface em português.
- Valores em BRL e datas em pt-BR (`formatBRL` e `formatDate` em `src/lib/format.ts`).
- Sem travessões longos em nenhum texto. Usar vírgulas ou pontos.
- Todo SQL começa com um título em comentário no topo.
- Toda tabela de negócio tem `tenant_id` e RLS obrigatório.
- Migrações ficam em `supabase/migrations/`.

## Regras de trabalho

- Qualquer mudança no banco ou no Resend deve ser avisada antes e entregue como SQL ou instrução para a Carol aplicar. Nunca executar direto.
- A `SUPABASE_SERVICE_ROLE_KEY` só existe no servidor: nunca com prefixo `NEXT_PUBLIC` e nunca importada em código de cliente. O único módulo que a lê é `src/lib/supabase/admin.ts` (`import "server-only"`).
- Variáveis de ambiente: ver `.env.example`. Nunca criar `.env.local` com valores reais.
- Os comandos de terminal são sempre em bash.
- Nunca fazer git add, git commit nem git push. Apenas preparar o código, rodar lint e build, listar o que mudou e sugerir a mensagem de commit. Quem faz add, commit e push é sempre a Carol. Nunca incluir Co-Authored-By, "Generated with Claude Code" ou qualquer menção a Claude ou Anthropic em mensagens de commit, PRs ou arquivos.
## Padrões de interface

### Botões

- Componente base: `src/components/ui/button.tsx` (`Button`, `buttonClasses` para links com aparência de botão e `IconButton`). Use sempre eles em vez de montar botões com classes soltas.
- Botão com texto nunca tem altura fixa (nada de `h-9`, `h-10`, `h-11`, `h-12`): `min-h-11` (44px) no celular, `min-h-10` no desktop, com `py-2`. O texto pode crescer para uma segunda linha (`leading-tight`, `text-balance`) e nunca é cortado: proibido `truncate` em rótulo de botão. Ícones com `shrink-0`.
- Filhos de flex que contêm botões ou texto levam `min-w-0` para poder encolher. Botões em linha usam `flex-1` ou `grow` quando devem dividir o espaço.
- Rótulo longo tem versão curta para espaço estreito, com container queries do Tailwind 4: `@container` no pai e `@sm:` no filho. A versão curta aparece em espaço estreito e o texto completo vai para `aria-label` e `title`.
- Botão só com ícone usa `IconButton`: 44x44px, `label` obrigatório (vira `aria-label` e `title`).
- Em ConfirmDialog e SidePanel no celular, os botões ficam empilhados em largura total com a ação principal em cima (violeta); a secundária tem borda e a destrutiva é vermelho suave.

- Toda ação que altera dado existente (editar e salvar, excluir, remover, arquivar, mudar status) abre ConfirmDialog; edição mostra o resumo do que muda (ChangesSummary). Criação e cálculo não. Nunca usar botão de confirmação inline.
- Excluir é sempre soft delete (deleted_at) e todo novo recurso com exclusão deve filtrar deleted_at is null e entrar no Histórico. Nunca devolver calc_input nem calc_result ao navegador, nem no Histórico. Tabelas com soft delete: tenant_printers, materials, quotes, quote_items, sales_channels, orders (order_items acompanham o pedido e não são excluídos um a um).

## Banco de dados

Colunas reais das migrations 017 (billing) e 018 (pedidos). Os nomes de colunas abaixo são a fonte da verdade; confira a Carol antes de criar colunas novas.

Pedidos (migration 018):

- `orders`: id, tenant_id, number (preenchido por gatilho: nunca enviar no insert), kind ('client' ou 'stock'), status ('placed','printing','ready','shipped','delivered','canceled'), quote_id, client_name, client_phone, due_date, payment_status ('pending' ou 'paid'), paid_at, tracking_code, notes, total (numeric 12,2, NUNCA gravar: recalculado por gatilho a partir de order_items.line_total), status_changed_at, deleted_at, created_at, updated_at.
- `order_items`: id, tenant_id, order_id, quote_item_id (nullable), description, quantity (inteiro maior que zero), unit_price (numeric 12,2), line_total (numeric 12,2, gravável), deleted_at, created_at. Não existe `position`: ordenar por created_at e depois por id.
- Regras: kind 'client' exige client_name (constraint orders_client_has_name). Índice único orders_quote_uidx: só um pedido ativo por orçamento (erro 23505: "Este orçamento já tem um pedido ativo").
- Atenção: orçamentos (`quotes`, `quote_items`) usam outros nomes (`customer_name`, `total_brl`, `unit_price_brl`). Não confundir com pedidos.

Billing (migration 017):

- `plans`: code, name, monthly_price_cents, active
- `plan_periods`: code, months, discount_pct, launch_discount_pct, sort_order
- `launch_config`: id (boolean, linha única), quota, price_months, reservation_minutes, active. Não existe `lock_months`: a duração do preço de lançamento é `price_months` (padrão 12).
- `coupons`: id, code, kind (launch ou referral), referrer_name, extra_discount_pct, commission_pct, commission_recurring, active, created_at. Não existem `expires_at` nem `is_active`: só `active`.
- `subscriptions`: id, tenant_id (unique), plan_code (obrigatório), period_code (nulável, nulo durante o teste), status (trialing, pending_payment, active, past_due, canceled, expired), trial_ends_at, current_period_end, list_price_cents, charged_price_cents, discount_pct_applied, launch_coupon_id, referral_coupon_id, promo_price_until, mp_preapproval_id, created_at, updated_at.

## Billing

As colunas de billing estão na seção "Banco de dados".

Teste de 7 dias: assinatura criada com plan_code `pro`, status `trialing`, trial_ends_at = agora + 7 dias e period_code nulo. Código em `src/lib/billing/` (`plans.ts`, `access.ts`, `coupons.ts`).

## Usuários, funções e permissões

- Funções: Dono (`owner`), Gerente (`manager`) e Operador (`operator`), em `tenant_members.role`. A matriz está em `src/lib/permissions.ts` (fonte única: `can(role, capability)`). Dono: tudo, incluindo Assinatura e Usuários. Gerente: tudo, menos Assinatura e Usuários (as rotas `/usuarios` e `/assinatura` ficam bloqueadas para ele). Operador: só Pedidos (vê número, cliente, itens sem valores, prazo e etapa; move apenas entre Pedido feito, Imprimindo e Pronto, nos dois sentidos) e Ajuda.
- No servidor, TODA Server Action, route handler e página confere a capacidade: `requireCapability` / `capabilityDenied` (`src/lib/permissions-server.ts`, mensagem "Você não tem permissão para fazer isso.") e `guardPage` nas páginas (redireciona para a página inicial da função; Operador cai em `/pedidos`). Action nova sem essa checagem não entra.
- Para o Operador o servidor NUNCA seleciona colunas de dinheiro, pagamento, telefone, rastreio nem observações dos pedidos (`getOrders(restricted)` e `getOrderItems(ids, restricted)` em `src/lib/orders-data.ts`). O banco também tem travas (migrations 024 e 025).
- Limite de usuários: `plans.max_users` (Pro 1, Loja 3), contando membros mais convites pendentes. Página `/usuarios` (antes chamada Equipe; `/equipe` redireciona de forma permanente): só o Dono vê, convida, remove e troca função, com a assinatura fora do modo leitura. Capacidades `view_users` e `manage_users`. Na sidebar e no menu do celular, "Usuários" e "Assinatura" ficam no grupo "Conta", visível só para o Dono. Remover alguém da equipe é a única exclusão real do sistema (`tenant_members` não tem `deleted_at`).
- Convites: token de 32 bytes aleatórios (base64url) criado com `crypto.randomBytes`; no banco vai só o hash SHA-256 (`token_hash`). O link é mostrado uma vez e o token nunca vai para logs. Como o token não é guardado, "Copiar link" e "Reenviar e-mail" geram um token novo e o anterior deixa de valer. Limite de 20 convites por loja por hora, validade de 7 dias. Aceitar (`/convite/[token]`, rota pública, `no-store` e `noindex` no `next.config.ts`): o e-mail do usuário logado e verificado precisa ser igual ao do convite; o convite é reservado com UPDATE `accepted_at is null` antes de criar a participação.
- E-mail do convite: Resend por `fetch`, com `RESEND_API_KEY` e `RESEND_FROM_EMAIL`. Sem as duas, só "Copiar link". Endereço do site: `NEXT_PUBLIC_SITE_URL`.
- Loja ativa: cookie httpOnly `voxa_tenant` (`src/lib/active-tenant.ts`). O servidor valida a participação a cada requisição em `getCurrentTenant()`: cookie válido, senão a loja onde a pessoa é Dono, senão a primeira. Seletor "Trocar de loja" só para quem tem mais de uma (`switchTenant`). Ao aceitar convite o cookie aponta para a loja do convite.
- Histórico mostra "por [nome ou e-mail]" (Auth, cliente admin); autor inexistente vira "Usuário removido".

## Retorno do login e do cadastro

E-mails de autenticação (cadastro com `emailRedirectTo`) e o login com Google (`redirectTo`) voltam para a origem onde a pessoa está, com `/auth/callback?next=...`, montado por `authCallbackUrl` em `src/lib/safe-redirect.ts`. `NEXT_PUBLIC_SITE_URL` só é usado se não houver origem. O `next` (por exemplo `/convite/[token]`) é sempre revalidado por `safeNextPath`: só caminhos internos. Novo fluxo que envie e-mail de autenticação (recuperação de senha, reenvio) deve usar o mesmo helper.

## Acesso por status da assinatura

Regras em `computeAccess` (`src/lib/billing/access.ts`, função pura). `GRACE_DAYS_PAST_DUE = 3`.

- `trialing`: acesso completo até `trial_ends_at`; depois, modo leitura.
- `active`: acesso completo. Rede de segurança: se `current_period_end` passou há mais de 3 dias, modo leitura.
- `past_due`: acesso completo até `current_period_end` + 3 dias, com aviso na faixa do topo ("Pagamento pendente. Regularize até DD/MM para evitar o bloqueio."); depois, modo leitura.
- `pending_payment`: mantém o acesso do teste (`trial_ends_at` no futuro) ou do período pago (`current_period_end` no futuro); senão, modo leitura.
- `canceled`: acesso completo até `current_period_end` (já pago); depois, modo leitura.
- `expired` (e status desconhecido): modo leitura.
- Falha segura em produção: com `NODE_ENV=production`, se a assinatura não puder ser lida nem criada, ou se `SUPABASE_SERVICE_ROLE_KEY` estiver ausente, a conta fica em modo leitura com "Não foi possível verificar sua assinatura agora. Tente novamente em instantes." Em desenvolvimento libera, com aviso no console.
- A faixa do topo é o `TrialBanner`; a mensagem de recusa de gravação vem de `access.message` (`writeBlockedMessage`).

## Limite de tentativas de cupom

`validateCoupon` e `getPriceGrid` chamam a função do banco `coupon_rate_check(p_key, p_limit)` (migration 022) com o cliente admin: 20 consultas a cada 10 minutos. Chave: `u:` + id do usuário, ou `ip:` + primeiro IP de `x-forwarded-for`. Se a função devolver false ou falhar, bloqueia (falha segura). Não existe limitador em memória.

## Resumo de alterações

Em `useConfirmSubmit`, campos numéricos levam `numeric: true`: a comparação ignora o formato digitado ("20", "20,00" e 20 são iguais, aceitando vírgula e ponto), strings são aparadas e vazio e nulo são iguais.

## Tutoriais interativos

- Definições em `src/lib/tours.ts` (`TOURS`); provedor em `src/components/tour/tour-provider.tsx`; cartão e destaque em `tour-overlay.tsx`. O componente é próprio (não usa biblioteca) porque os painéis abrem em `<dialog>` modal, que fica na camada de cima do navegador: a sobreposição é criada dentro do `<dialog>` quando o elemento destacado está nele.
- Como criar um tutorial novo: (1) dê um `id` único e `version: 1` em `TOURS`; aumentar a `version` reexibe o tutorial; (2) marque os elementos reais com `data-tour="nome"` e use `[data-tour="nome"]` no passo; (3) coloque `<AutoTour id="..." />` na página (`kind: "page"`) ou dentro do painel ou formulário (`kind: "action"`); (4) use `requires` quando o recurso depende do plano.
- Regras de texto: título com até 4 palavras, texto com até 140 caracteres, linguagem direta ("Clique aqui para..."), sem prometer resultado financeiro.
- Regras de comportamento: um tutorial por vez, só um de página por visita, nunca com ConfirmDialog aberto; passos cujo alvo não existe ou não está visível são pulados; o início automático só acontece se o primeiro alvo existir (espera até 2 s). Trocar de página encerra o tutorial sem marcar como concluído.
- Estado no `localStorage`, sempre com try/catch, só com marcadores: `voxa:tour:{userId}:{tourId}:v{version}` = "done" ou "skipped", e `voxa:tour:{userId}:disabled` = "1". Nunca guardar dados do negócio. O botão Ajuda do cabeçalho tem "Ver tutorial desta tela", "Refazer todos os tutoriais" e "Desativar tutoriais".

## Painel

- Página `/painel` (primeira da sidebar e destino do login). Os números vêm de `src/lib/dashboard.ts` (`import "server-only"`), por UMA chamada ao RPC `dashboard_stats` (migration 023) com o cliente do usuário (RLS), sem limite de registros: `p_tenant`, `p_today` (hoje em America/Sao_Paulo) e os inícios do mês atual, seguinte e anterior com deslocamento -03:00. Se o RPC falhar, o Painel mostra "Não foi possível carregar o resumo agora." e nunca zeros. Só as listas curtas (limit 5) são consultas diretas. Nenhum "use client" consulta o banco.
- Pedidos de estoque não entram em atrasos, pagamentos nem faturamento (só `kind = 'client'`). Faturamento do mês = pedidos pagos com `paid_at` no mês e status diferente de cancelado. Atalhos do Painel usam `/pedidos?atrasados=1`, `?tipo=stock`, `?coluna=<etapa>` e `/orcamentos?status=...`.
- Conta sem dados mostra um cartão simples com o botão "Cadastrar máquina". O guia de primeiros passos em checklist NÃO existe: será um tutorial interativo, em outra tarefa.
- Ajudante "Quanto cobrar pela sua hora?": a conta (ganho do mês / (horas por semana x 4,33 x % produtivo)) roda na Server Action `calculateHourlyRate` (`painel/actions.ts`), com validação em `src/lib/hourly-rate-schema.ts`. Gravar o resultado usa `saveCostSettings` com ConfirmDialog e ChangesSummary, e respeita o modo leitura e o Histórico.

## Vagas de lançamento

- Nunca exibir nem enviar ao navegador a quantidade de vagas restantes. Usar o nível (`getLaunchLevel()` em `src/lib/billing/launch.ts`): `open`, `last` (até `LAST_SPOTS_THRESHOLD` vagas), `soldout` ou `hidden` (não foi possível saber: não mostrar banner). A função do banco `launch_remaining()` só é chamada no servidor, com o cliente admin.
- O destaque é o `LaunchBanner` (`src/components/billing/launch-banner.tsx`), sem números, sem prazo e sem contagem regressiva, porque a promoção não tem data final.

## Pedidos

- Página `/pedidos` (feature `orders`, Pro e Loja): quadro em colunas (Pedido feito, Imprimindo, Pronto, Enviado, Entregue; Cancelado recolhido). Tipos: `client` (Cliente) e `stock` (Produção para estoque, termina em Pronto).
- O fluxo de status está em `ORDER_TRANSITIONS` (`src/lib/orders.ts`), fonte única da interface e do servidor. O servidor sempre valida a transição lendo o status atual do banco. Pedido Entregue ou Cancelado fica somente leitura até reabrir. O pagamento é independente do status: dá para marcar como pago ou pendente também em pedido Entregue (com confirmação e registro no Histórico); só o Cancelado bloqueia.
- Navegação entre etapas: sempre **Voltar à esquerda e Avançar à direita** no cartão e no painel (`OrderNav` em `src/app/(app)/pedidos/order-nav.tsx`). A sequência de cada tipo é `ORDER_SEQUENCE` e os destinos vêm de `getNextStatus`, `getPreviousStatus` e `getMoveGroups` (`src/lib/orders.ts`), nunca da ordem das chaves de `ORDER_TRANSITIONS`. As demais ações (outros destinos, Reabrir, Excluir e, por último e em vermelho, Cancelar pedido) ficam no menu "Mais". Botões de toque com no mínimo 44px no celular.
- Pagamento (tipo Cliente): o selo do cartão e do painel é um botão (`PaymentButton`) que abre o ConfirmDialog e chama `setOrderPayment`. Vale em todos os status, inclusive Entregue; só Cancelado fica somente leitura. Pedido para estoque não tem pagamento.
- "Avisar cliente" (WhatsApp) aparece em todo pedido de cliente Pronto ou Enviado (`canNotify`); sem telefone válido o botão fica desabilitado com ajuda.
- Gerar pedido de orçamento aprovado pergunta se o pagamento já foi recebido (Ainda não, Já foi pago, Recebi um sinal) e o prazo de entrega.
- Pedido gerado de orçamento aprovado copia só cliente, telefone, descrição, quantidade e valor dos itens. Nunca `calc_input` nem `calc_result`.
- Server Actions em `src/app/(app)/pedidos/actions.ts`; toda ação que grava chama `writeBlockedMessage`. Exclusão é soft delete.

## Proteção da lógica e dos dados do produto

- Todo cálculo de orçamento roda no servidor (Server Action ou Route Handler).
  Componente com "use client" nunca contém fórmula, coeficiente nem tabela de
  valores. O navegador recebe só o resultado.
- Nada de NEXT_PUBLIC_ para segredo. Source maps de produção desativados.
- Catálogos globais (printer_catalog, energy_distributors, energy_tariffs) só
  por função RPC, uma consulta pontual por vez. Proibido select direto, listagem
  com especificações e botão "exportar tudo".
- Toda função RPC nova chama public.rpc_rate_limit.
- Exportações (CSV e PDF) só de dados do próprio tenant.
- Orçamento mostrado ao cliente final exibe só o preço final, sem detalhamento.
- Todo cálculo de orçamento chama public.calc_check_limit antes de calcular (limite de 300 por hora por usuário e tipo).
- Tarifas de energia: consulta só por Server Action, uma por vez, via energy_list_distributors e energy_get_tariff, com limite por hora. Nunca listar nem exportar todas as tarifas.
