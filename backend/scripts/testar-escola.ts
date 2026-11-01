/**
 * Conferência da Fase 5, Parte 3: eventos da escola e apoio presencial (mantidos pela gestão) e
 * lembretes (pessoais). Cria usuários de teste temporários (e-mails `teste-escola-*`), um horário
 * de grade próprio do teste, testa via HTTP e apaga tudo ao final. Os eventos do teste usam o ano
 * de 2099, para não se misturar com o calendário real.
 *
 * Uso: npm run test:escola
 */
import 'dotenv/config';
import type { AddressInfo } from 'node:net';
import type { app_role } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';

let falhas = 0;
function check(ok: boolean, descricao: string) {
  console.log(`${ok ? '✅' : '❌'} ${descricao}`);
  if (!ok) falhas++;
}

const PREFIXO = `teste-escola-${Date.now()}`;
const SENHA = 'SenhaDeTeste123';
const email = (nome: string) => `${PREFIXO}-${nome}@prof.educacao.sp.gov.br`;
const INEXISTENTE = '00000000-0000-4000-8000-000000000000';

async function criarUsuario(nome: string, role: app_role) {
  return prisma.usuarios.create({
    data: {
      email: email(nome),
      senha_hash: await hashPassword(SENHA),
      profile: { create: { nome: `Teste ${nome}`, email: email(nome), status: 'ativo' } },
      user_roles: { create: { role } },
    },
  });
}

type Evento = { id: string; titulo: string; tipo: string; data_inicio: string; data_fim: string | null; dia_todo: boolean; criado_por: string };
type Apoio = { id: string; data: string; professor_id: string; responsavel_id: string; horario_grade_id: string | null; criado_por: string };
type Lembrete = { id: string; titulo: string; prioridade: string; cor: string; data: string | null; concluido: boolean; fixado: boolean; user_id: string };

async function main() {
  const server = app.listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  const ids: string[] = [];
  let horarioId: string | undefined;

  async function call(method: string, path: string, { body, token }: { body?: unknown; token?: string } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, text, json: text ? JSON.parse(text) : null };
  }
  const token = async (nome: string) =>
    (await call('POST', '/auth/login', { body: { email: email(nome), senha: SENHA } })).json.token as string;
  const codigo = (r: { json: { error?: { code: string } } | null }) => r.json?.error?.code;

  try {
    const admin = await criarUsuario('admin', 'admin');
    const coord = await criarUsuario('coord', 'coordenador');
    const direcao = await criarUsuario('direcao', 'direcao');
    const profA = await criarUsuario('profa', 'professor');
    const profB = await criarUsuario('profb', 'professor');
    ids.push(admin.id, coord.id, direcao.id, profA.id, profB.id);
    const tAdmin = await token('admin');
    const tCoord = await token('coord');
    const tDirecao = await token('direcao');
    const tA = await token('profa');
    const tB = await token('profb');
    const horario = await prisma.horario_grade.create({
      data: { ordem: 903, rotulo: `${PREFIXO} 3ª aula`, hora_inicio: new Date('1970-01-01T08:40:00Z'), hora_fim: new Date('1970-01-01T09:30:00Z') },
    });
    horarioId = horario.id;

    console.log('\n— Eventos da escola —');
    const evento = (body: object, t = tCoord) => call('POST', '/eventos-escola', { token: t, body });
    const ev1 = await evento({ titulo: `${PREFIXO} Conselho`, tipo: 'conselho', data_inicio: '2099-03-10T14:00', data_fim: '2099-03-10T17:00' });
    const e1 = ev1.json as Evento;
    check(ev1.status === 201 && e1.criado_por === coord.id && e1.tipo === 'conselho', 'Coordenação cria um evento');
    check(e1.data_inicio === '2099-03-10T14:00:00.000Z' && e1.data_fim === '2099-03-10T17:00:00.000Z', 'Hora sem fuso é gravada como veio (UTC, como no Supabase)');
    const ev2 = await evento({ titulo: `${PREFIXO} Feriado`, data_inicio: '2099-04-21', dia_todo: true });
    check(ev2.status === 201 && ev2.json.tipo === 'aviso' && ev2.json.dia_todo === true, 'Evento de dia inteiro; tipo padrão "aviso"');
    check(codigo(await evento({ titulo: 'X' })) === 'DADOS_INVALIDOS', 'Sem data de início → erro de dados');
    check(codigo(await evento({ titulo: 'X', data_inicio: '2099-02-30' })) === 'DADOS_INVALIDOS', 'Data impossível → erro de dados');
    check(codigo(await evento({ titulo: 'X', data_inicio: '10/03/2099' })) === 'DADOS_INVALIDOS', 'Data em outro formato → erro de dados');
    check(codigo(await evento({ titulo: 'X', data_inicio: '2099-03-10T14:00', data_fim: '2099-03-10T13:00' })) === 'DADOS_INVALIDOS', 'Fim antes do início → erro de dados');
    check(codigo(await evento({ titulo: 'X', data_inicio: '2099-03-10', tipo: 'festa' })) === 'DADOS_INVALIDOS', 'Tipo inventado → erro de dados');
    check((await evento({ titulo: 'X', data_inicio: '2099-03-10' }, tA)).status === 403, 'Professor não cria evento');
    const doAno = (await call('GET', '/eventos-escola?de=2099-01-01&ate=2099-12-31', { token: tA })).json as Evento[];
    check(doAno.length === 2 && doAno[0].id === e1.id, 'Professor vê os eventos do período, em ordem');
    check((await call('GET', '/eventos-escola?de=2099-03-10&ate=2099-03-10', { token: tA })).json.length === 1, 'O "até" inclui o dia inteiro');
    check((await call('GET', '/eventos-escola?tipo=conselho&de=2099-01-01', { token: tA })).json.length === 1, 'Filtra por tipo');
    const edit = await call('PATCH', `/eventos-escola/${e1.id}`, { token: tDirecao, body: { titulo: `${PREFIXO} Conselho de classe` } });
    check(edit.status === 200 && edit.json.titulo.endsWith('Conselho de classe') && edit.json.criado_por === coord.id, 'Outra pessoa da gestão (direção) altera; o criador continua o mesmo');
    check(codigo(await call('PATCH', `/eventos-escola/${e1.id}`, { token: tCoord, body: { data_fim: '2099-03-09' } })) === 'DADOS_INVALIDOS', 'Alterar o fim para antes do início → erro de dados');
    check((await call('PATCH', `/eventos-escola/${e1.id}`, { token: tA, body: { titulo: 'X' } })).status === 403, 'Professor não altera');
    check(codigo(await call('PATCH', `/eventos-escola/${INEXISTENTE}`, { token: tCoord, body: { titulo: 'X' } })) === 'EVENTO_NAO_ENCONTRADO', 'Evento inexistente → não encontrado');
    check((await call('DELETE', `/eventos-escola/${e1.id}`, { token: tA })).status === 403, 'Professor não exclui');
    check((await call('DELETE', `/eventos-escola/${e1.id}`, { token: tAdmin })).status === 204, 'Admin exclui');
    check((await call('GET', '/eventos-escola')).status === 401, 'Sem login não vê');

    console.log('\n— Apoio presencial —');
    const apoio = (body: object, t = tCoord) => call('POST', '/apoio-presencial', { token: t, body });
    const ap1 = await apoio({ data: '2099-03-11', professor_id: profA.id, responsavel_id: coord.id, horario_grade_id: horario.id, observacao: 'Leitura' });
    const a1 = ap1.json as Apoio;
    check(ap1.status === 201 && a1.data === '2099-03-11' && a1.criado_por === coord.id && a1.horario_grade_id === horario.id, 'Coordenação marca apoio presencial na aula do professor A');
    await apoio({ data: '2099-03-12', professor_id: profB.id, responsavel_id: direcao.id });
    check(codigo(await apoio({ data: '2099-03-11', professor_id: profA.id })) === 'DADOS_INVALIDOS', 'Sem responsável → erro de dados');
    check(codigo(await apoio({ data: '2099-03-11', professor_id: INEXISTENTE, responsavel_id: coord.id })) === 'USUARIO_INVALIDO', 'Professor inexistente → usuário inválido');
    check(codigo(await apoio({ data: '2099-03-11', professor_id: profA.id, responsavel_id: coord.id, horario_grade_id: INEXISTENTE })) === 'HORARIO_INVALIDO', 'Horário inexistente → horário inválido');
    check((await apoio({ data: '2099-03-11', professor_id: profA.id, responsavel_id: coord.id }, tA)).status === 403, 'Professor não marca apoio');
    const periodo = '?de=2099-01-01&ate=2099-12-31';
    const doA = (await call('GET', `/apoio-presencial${periodo}`, { token: tA })).json;
    check(doA.length === 1, 'Professor A vê só o apoio dele');
    check(doA[0]?.professor_nome === 'Teste profa' && doA[0]?.responsavel_nome === 'Teste coord', 'Com os nomes do professor e do responsável');
    check((await call('GET', `/apoio-presencial${periodo}`, { token: tB })).json.length === 1, 'Professor B vê só o dele');
    check((await call('GET', `/apoio-presencial${periodo}`, { token: tDirecao })).json.length === 2, 'Gestão vê todos');
    check((await call('GET', `/apoio-presencial${periodo}&professor_id=${profA.id}`, { token: tCoord })).json.length === 1, 'Gestão filtra por professor');
    check((await call('PATCH', `/apoio-presencial/${a1.id}`, { token: tCoord, body: { observacao: 'Leitura compartilhada' } })).json?.observacao === 'Leitura compartilhada', 'Gestão altera');
    check((await call('PATCH', `/apoio-presencial/${a1.id}`, { token: tA, body: { observacao: 'X' } })).status === 403, 'Professor não altera');
    check((await call('DELETE', `/apoio-presencial/${a1.id}`, { token: tCoord })).status === 204, 'Gestão exclui');
    check(codigo(await call('DELETE', `/apoio-presencial/${a1.id}`, { token: tCoord })) === 'APOIO_NAO_ENCONTRADO', 'Excluir de novo → não encontrado');

    console.log('\n— Lembretes —');
    const lembrete = (body: object, t = tA) => call('POST', '/lembretes', { token: t, body });
    const l1 = await lembrete({ titulo: 'Corrigir provas', data: '2099-03-15', prioridade: 'alta', cor: 'rosa' });
    const r1 = l1.json as Lembrete;
    check(l1.status === 201 && r1.user_id === profA.id && r1.prioridade === 'alta' && r1.data === '2099-03-15', 'Professor cria um lembrete');
    const l2 = await lembrete({ titulo: 'Reunião de pais' });
    check(l2.json?.prioridade === 'media' && l2.json.cor === 'amarelo' && l2.json.concluido === false, 'Padrões: prioridade média, amarelo, não concluído');
    check(codigo(await lembrete({ titulo: '  ' })) === 'DADOS_INVALIDOS', 'Sem título → erro de dados');
    check(codigo(await lembrete({ titulo: 'X', cor: 'preto' })) === 'DADOS_INVALIDOS', 'Cor inventada → erro de dados');
    check(codigo(await lembrete({ titulo: 'X', prioridade: 'urgente' })) === 'DADOS_INVALIDOS', 'Prioridade inventada → erro de dados');
    await call('PATCH', `/lembretes/${r1.id}`, { token: tA, body: { fixado: true } });
    const meus = (await call('GET', '/lembretes', { token: tA })).json as Lembrete[];
    check(meus.length === 2 && meus[0].id === r1.id && meus[0].fixado, 'Lista os próprios, fixados primeiro');
    check((await call('PATCH', `/lembretes/${r1.id}`, { token: tA, body: { concluido: true } })).json?.concluido === true, 'Marca como feito');
    check((await call('GET', '/lembretes', { token: tB })).json.length === 0 && (await call('GET', '/lembretes', { token: tCoord })).json.length === 0, 'Ninguém vê os lembretes de outra pessoa, nem a gestão');
    check(codigo(await call('PATCH', `/lembretes/${r1.id}`, { token: tAdmin, body: { concluido: false } })) === 'LEMBRETE_NAO_ENCONTRADO', 'Nem o admin mexe nos lembretes de outra pessoa');
    check(codigo(await call('DELETE', `/lembretes/${r1.id}`, { token: tB })) === 'LEMBRETE_NAO_ENCONTRADO', 'Professor B não apaga');
    check((await call('DELETE', `/lembretes/${r1.id}`, { token: tA })).status === 204, 'Dono apaga');
  } finally {
    server.close();
    // Os usuários levam eventos, apoios e lembretes; depois sai o horário do teste.
    const turmas = await prisma.turmas.deleteMany({ where: { user_id: { in: ids } } });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    if (horarioId) await prisma.horario_grade.delete({ where: { id: horarioId } }).catch(() => undefined);
    console.log(`\n🧹 ${count} usuários de teste (com eventos, apoios e lembretes), ${turmas.count} turmas e o horário de teste apagados.`);
  }

  console.log(falhas === 0 ? '\nTudo certo ✅' : `\n${falhas} falha(s) ❌`);
  if (falhas) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
