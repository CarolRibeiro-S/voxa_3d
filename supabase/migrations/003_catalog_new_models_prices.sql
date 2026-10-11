begin;
-- Titulo: Voxa3D 003 - catalogo de impressoras: 5 modelos novos, origem do consumo medio e precos de referencia
-- Rode por inteiro. Depois dela o catalogo deve ter 23 modelos.

-- 1) Colunas novas
alter table public.printer_catalog
  add column if not exists price_ref_source text,
  add column if not exists price_ref_date date,
  add column if not exists avg_power_basis text
    check (avg_power_basis in ('fabricante', 'medicao', 'estimativa'));

comment on column public.printer_catalog.avg_power_basis is
  'Origem do consumo medio: fabricante, medicao ou estimativa (35% da potencia nominal, arredondado para 5 W).';
comment on column public.printer_catalog.price_ref_source is 'Origem do preco de referencia em reais.';
comment on column public.printer_catalog.price_ref_date is 'Data da pesquisa do preco de referencia.';

-- 2) Modelos novos
insert into public.printer_catalog
  (type, brand, model, build_x_mm, build_y_mm, build_z_mm, rated_power_w, avg_power_w, enclosed, hardened_nozzle, multicolor, screen_size_in, notes)
values
  ('fdm',   'Bambu Lab', 'P2S',                       256, 256, 256, 1200, 200,  true,  false, true, null, null),
  ('fdm',   'Bambu Lab', 'H2S',                       340, 320, 340, 2050, null, true,  null,  true, null, null),
  ('fdm',   'Creality',  'K2 Pro',                    300, 300, 300, 1300, null, true,  null,  true, null, null),
  ('fdm',   'Elegoo',    'Centauri Carbon 2',         256, 256, 256, 1100, null, true,  null,  null, null, null),
  ('resin', 'Elegoo',    'Saturn 4 Ultra 16K',        212, 118, 220, 144,  null, null,  null,  null, 10.0, null)
on conflict (brand, model) do nothing;

-- 3) Origem do consumo medio (valores com fonte)
update public.printer_catalog set avg_power_basis = 'medicao'
  where brand = 'Bambu Lab' and model = 'A1 mini';
update public.printer_catalog set avg_power_basis = 'fabricante'
  where (brand, model) in (('Bambu Lab', 'H2D'), ('Prusa', 'MK4S'), ('Bambu Lab', 'P2S'));

-- 4) Estimativa para quem ainda nao tem consumo medio (35% da nominal, arredondado de 5 em 5 W)
update public.printer_catalog
  set avg_power_w = (round(rated_power_w * 0.35 / 5) * 5)::integer,
      avg_power_basis = 'estimativa'
  where avg_power_w is null and rated_power_w is not null;

-- 5) Precos de referencia em reais (pesquisa de 09/10/2026)
update public.printer_catalog as c
  set price_ref_brl = v.preco,
      price_ref_source = 'Pesquisa em lojas brasileiras',
      price_ref_date = date '2026-10-09'
  from (values
    ('Bambu Lab', 'A1 mini',       2319.00),
    ('Bambu Lab', 'A1',            2676.15),
    ('Creality',  'Ender-3 V3 SE', 1609.99),
    ('Creality',  'K1C',           4301.10),
    ('Elegoo',    'Neptune 4 Pro', 2692.50)
  ) as v(brand, model, preco)
  where c.brand = v.brand and c.model = v.model;

-- 6) Precos de combos (nao sao a impressora sozinha), apenas nas observacoes
update public.printer_catalog set notes = concat_ws(' ', notes, 'Combo com AMS: R$ 7.109,90 (pesquisa de 09/10/2026).')
  where brand = 'Bambu Lab' and model = 'P1S';
update public.printer_catalog set notes = concat_ws(' ', notes, 'Combo: R$ 17.399,90 (pesquisa de 09/10/2026).')
  where brand = 'Bambu Lab' and model = 'H2S';
update public.printer_catalog set notes = concat_ws(' ', notes, 'Combo: R$ 19.630,00 (pesquisa de 09/10/2026).')
  where brand = 'Creality' and model = 'K2 Plus';

commit;

-- Conferencia (rode separado, depois): esperado 23 modelos, 1 medicao, 3 fabricante, 19 estimativa, 5 com preco
-- select count(*) as modelos,
--        count(*) filter (where avg_power_basis = 'medicao') as medicao,
--        count(*) filter (where avg_power_basis = 'fabricante') as fabricante,
--        count(*) filter (where avg_power_basis = 'estimativa') as estimativa,
--        count(*) filter (where price_ref_brl is not null) as com_preco
-- from public.printer_catalog;
