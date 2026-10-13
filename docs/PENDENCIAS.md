# Pendências do Voxa3D

Lista de tudo o que ainda falta. Marque as caixas conforme for concluindo.

## Antes de vender

- [ ] Integrar o Mercado Pago:
  - [ ] cartão recorrente
  - [ ] Pix por período
  - [ ] webhook com assinatura verificada
  - [ ] estorno quando a cota de lançamento esgotar entre o pagamento e a confirmação
  - [ ] reserva e confirmação da vaga de lançamento
- [ ] E-mail de aviso 30 dias antes do fim do preço promocional (Resend).
- [ ] Termos de Uso, Política de Privacidade (LGPD) e regulamento da promoção de lançamento (primeiras 30 assinaturas, com o preço mantido por 12 meses).
- [ ] Definir a retenção automática da lixeira e do histórico (por exemplo, 90 dias).
- [ ] Trocar a chave secreta que apareceu em print.
- [ ] Confirmação de e-mail no cadastro e publicação do login com Google.
- [ ] Registro da marca no INPI.
- [ ] Migração de MEI para ME.
- [ ] Plano Pro do Supabase.
- [ ] Acordo da Wanda por escrito (comissão de 20%: recorrente ou só na primeira venda).
- [ ] Definir a hospedagem.

## Produto

- [x] Vários usuários no plano Loja (convite, funções Dono, Gerente e Operador, limite por plano, histórico mostrando quem alterou, permissões do Desfazer).
- [ ] Histórico de ações de usuários: convites e remoções.
- [ ] Esconder valores do Operador também no banco, com visões separadas.
- [ ] Editar os itens de um pedido existente.
- [ ] Tutorial interativo de primeiro uso (feito: revisar o texto dos passos com usuários reais).
- [ ] Produtos, estoque e vendas por canal.
- [ ] Site inicial (página de apresentação).
- [ ] Arrastar e soltar no kanban de pedidos (opcional).
- [ ] Limite de máquinas por plano (hoje não existe).

## Operação

- [ ] Atualizar as tarifas da ANEEL depois de 21 e 22/10/2026 (Neoenergia Brasília, Equatorial GO, CPFL Piratininga, EDP SP e outras).
- [ ] Manter o arquivo docs/db-schema.txt atualizado a cada mudança de banco (hoje ele não existe no projeto).
- [ ] Salvar todas as migrations em supabase/migrations (hoje só algumas estão no repositório).
