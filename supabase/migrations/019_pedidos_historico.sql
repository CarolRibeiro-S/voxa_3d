-- 019 Pedidos: histórico de alterações (audit_log) para orders e order_items
--
-- Liga o gatilho de histórico que já existe (public.audit_row_change_trg, criado na 014 e
-- usado na 016 para sales_channels) nas duas tabelas de pedidos. O app só LÊ o audit_log e
-- filtra os campos pela lista de campos permitidos (src/lib/audit.ts), por isso observações
-- do pedido (notes) não aparecem no Histórico.
--
-- ATENÇÃO: este arquivo foi escrito sem acesso às migrations 014 e 016. Antes de aplicar,
-- compare com a forma como a 016 ligou o gatilho em sales_channels (nome do gatilho, momento,
-- argumentos). Se a função escolhe o "summary" por tabela (CASE em TG_TABLE_NAME), acrescente
-- os ramos: orders => número com 4 dígitos + nome do cliente (ou 'Estoque'), e
-- order_items => descrição do item.
--
-- Para desfazer esta migration, rode:
--   drop trigger if exists orders_audit_trg on public.orders;
--   drop trigger if exists order_items_audit_trg on public.order_items;

drop trigger if exists orders_audit_trg on public.orders;
create trigger orders_audit_trg
  after insert or update or delete on public.orders
  for each row execute function public.audit_row_change_trg();

drop trigger if exists order_items_audit_trg on public.order_items;
create trigger order_items_audit_trg
  after insert or update or delete on public.order_items
  for each row execute function public.audit_row_change_trg();
