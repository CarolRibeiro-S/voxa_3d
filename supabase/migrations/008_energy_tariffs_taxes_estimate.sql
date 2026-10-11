begin;
-- Titulo: Voxa3D 008 - ICMS (faixa mais alta por estado) e PIS/COFINS medio estimados nas tarifas
-- Valores de referencia marcados como estimativa; o usuario pode editar na tela.
-- So atualiza linhas que ainda estao com impostos zerados.
update public.energy_tariffs t
set icms_pct = u.icms,
    pis_cofins_pct = 5,
    source = 'ANEEL dados abertos (TE e TUSD sem impostos); ICMS da faixa mais alta do estado e PIS/COFINS medio de 5% sao estimativas'
from public.energy_distributors d
join (values
  ('AC', 19.0), ('AL', 20.5), ('AM', 20.0), ('AP', 18.0), ('BA', 20.5), ('CE', 20.0),
  ('DF', 20.0), ('ES', 17.0), ('GO', 19.0), ('MA', 20.0), ('MG', 18.0), ('MS', 17.0),
  ('MT', 17.0), ('PA', 19.0), ('PB', 20.0), ('PE', 20.5), ('PI', 22.5), ('PR', 19.0),
  ('RJ', 20.0), ('RN', 20.0), ('RO', 19.5), ('RR', 20.0), ('RS', 17.0), ('SC', 17.0),
  ('SE', 20.0), ('SP', 18.0), ('TO', 20.0)
) as u(uf, icms) on u.uf = d.state
where t.distributor_id = d.id
  and t.icms_pct = 0
  and t.pis_cofins_pct = 0;
commit;

-- Conferencia: deve retornar 96 linhas com ICMS maior que zero
select count(*) as com_icms from public.energy_tariffs where icms_pct > 0;
