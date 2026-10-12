@AGENTS.md

# Voxa3D

SaaS multi-tenant de gestão para negócios de impressão 3D (FDM e resina). Domínio: voxa3d.com.br.
Repositório: https://github.com/CarolRibeiro-S/voxa_3d.git

## Planos

| Plano | Preço | Features |
| --- | --- | --- |
| Calculadora | R$ 47 (pagamento único) | calculator, quotes |
| Pro | R$ 79 por mês (1 usuário) | calculator, quotes, orders_kanban, finance, sales_reports, stock, maintenance |
| Loja | R$ 149 por mês (vários usuários com permissão por aba) | tudo do Pro, mais multi_user e public_quote |

Fonte da verdade: `src/lib/plans.ts` (`hasFeature(plan, feature)`). O plano real vem de `tenants.plan` via `getCurrentTenant()` em `src/lib/tenant.ts`. Itens da sidebar que o plano não inclui aparecem com cadeado (Lock), sem esconder o item.

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
- A `SUPABASE_SERVICE_ROLE_KEY` só existe no servidor: nunca com prefixo `NEXT_PUBLIC` e nunca importada em código de cliente.
- Variáveis de ambiente: ver `.env.example`. Nunca criar `.env.local` com valores reais.
- Os comandos de terminal são sempre em bash.
- Nunca fazer git add, git commit nem git push. Apenas preparar o código, rodar lint e build, listar o que mudou e sugerir a mensagem de commit. Quem faz add, commit e push é sempre a Carol. Nunca incluir Co-Authored-By, "Generated with Claude Code" ou qualquer menção a Claude ou Anthropic em mensagens de commit, PRs ou arquivos.
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
