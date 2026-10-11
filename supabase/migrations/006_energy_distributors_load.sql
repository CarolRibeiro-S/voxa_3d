begin;
-- Titulo: Voxa3D 006 - carga de distribuidoras de energia com estado (ANEEL SigAgente como chave)
-- Observacao: apenas distribuidoras com estado confirmado; cooperativas ficam de fora por enquanto
insert into public.energy_distributors (aneel_code, name, state) values
('CEEE-D', 'Equatorial CEEE Distribuição', 'RS'),
('RGE', 'RGE (CPFL RGE)', 'RS'),
('CELESC', 'Celesc Distribuição', 'SC'),
('COPEL-DIS', 'Copel Distribuição', 'PR'),
('CEMIG-D', 'Cemig Distribuição', 'MG'),
('ENEL RJ', 'Enel Rio', 'RJ'),
('LIGHT SESA', 'Light', 'RJ'),
('EDP ES', 'EDP Espírito Santo', 'ES'),
('EDP SP', 'EDP São Paulo', 'SP'),
('ELEKTRO', 'Neoenergia Elektro', 'SP'),
('ELETROPAULO', 'Enel São Paulo', 'SP'),
('CPFL-PAULISTA', 'CPFL Paulista', 'SP'),
('CPFL-PIRATINING', 'CPFL Piratininga', 'SP'),
('CPFL Santa Cruz', 'CPFL Santa Cruz', 'SP'),
('COELBA', 'Neoenergia Coelba', 'BA'),
('COSERN', 'Neoenergia Cosern', 'RN'),
('EPB', 'Energisa Paraíba', 'PB'),
('Neoenergia PE', 'Neoenergia Pernambuco', 'PE'),
('Neoenergia Brasília', 'Neoenergia Brasília', 'DF'),
('ENEL CE', 'Enel Ceará', 'CE'),
('EQUATORIAL AL', 'Equatorial Alagoas', 'AL'),
('EQUATORIAL GO', 'Equatorial Goiás', 'GO'),
('EQUATORIAL MA', 'Equatorial Maranhão', 'MA'),
('EQUATORIAL PA', 'Equatorial Pará', 'PA'),
('EQUATORIAL PI', 'Equatorial Piauí', 'PI'),
('EMS', 'Energisa Mato Grosso do Sul', 'MS'),
('EMT', 'Energisa Mato Grosso', 'MT'),
('EMR', 'Energisa Minas Rio', 'MG'),
('ESE', 'Energisa Sergipe', 'SE'),
('ETO', 'Energisa Tocantins', 'TO'),
('EAC', 'Energisa Acre', 'AC'),
('ERO', 'Energisa Rondônia', 'RO'),
('ELFSM', 'Empresa Luz e Força Santa Maria', 'ES'),
('SULGIPE', 'Energisa Sul Sergipe', 'SE'),
('CEA', 'Companhia de Eletricidade do Amapá', 'AP'),
('Âmbar Amazonas', 'Âmbar Energia Amazonas', 'AM'),
('ÂMBAR ENERGIA RR', 'Âmbar Energia Roraima', 'RR'),
('HIDROPAN', 'Hidropan', 'RS'),
('MUXENERGIA', 'Muxfeldt Marin (Muxenergia)', 'RS'),
('UHENPAL', 'Uhenpal', 'RS'),
('EFLJC', 'Energética Força e Luz João Cesa', 'SC'),
('EFLUL', 'Empresa Força e Luz Urussanga', 'SC'),
('DCELT', 'Dcelt Distribuição', 'SC'),
('DMED', 'DMED Distribuição', 'MG'),
('CHESP', 'Chesp', 'GO'),
('COCEL', 'Cocel', 'PR'),
('COPREL', 'Coprel', 'RS'),
('DEMEI', 'Demei', 'RS')
on conflict (aneel_code) do nothing;

commit;

-- Conferencia: deve retornar 48
select count(*) from public.energy_distributors;
