/**
 * Conferência da Fase 5, Parte 2: agenda do professor (rotina da semana e exceções de um dia).
 * Cria usuários de teste temporários (e-mails `teste-agenda-*`), horários de grade próprios do teste
 * (a grade real não é tocada), turmas e matérias, testa via HTTP e apaga tudo ao final.
 *
 * Uso: npm run test:agenda
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

const PREFIXO = `teste-agenda-${Date.now()}`;
const SENHA = 'SenhaDeTeste123';
const email = (nome: string) => `${PREFIXO}-${nome}@prof.educacao.sp.gov.br`;
const INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const hora = (h: string) => new Date(`1970-01-01T${h}:00Z`);

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

type Rotina = { id: string; user_id: string; dia_semana: number; horario_grade_id: string; turma_id: string | null; disciplina_id: string | null; atividade: string | null; cor: string | null };
type Excecao = { id: string; user_id: string; data: string; horario_grade_id: string; cancelado: boolean; atividade: string | null; observacao: string | null; turma_id: string | null };

async function main() {
  const server = app.listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  const ids: string[] = [];
  const horarios: string[] = [];

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
    const profA = await criarUsuario('profa', 'professor');
    const profB = await criarUsuario('profb', 'professor');
    ids.push(admin.id, coord.id, profA.id, profB.id);
    const tAdmin = await token('admin');
    const tCoord = await token('coord');
    const tA = await token('profa');
    const tB = await token('profb');

    const h1 = await prisma.horario_grade.create({ data: { ordem: 901, rotulo: `${PREFIXO} 1ª aula`, hora_inicio: hora('07:00'), hora_fim: hora('07:50') } });
    const h2 = await prisma.horario_grade.create({ data: { ordem: 902, rotulo: `${PREFIXO} 2ª aula`, hora_inicio: hora('07:50'), hora_fim: hora('08:40') } });
    horarios.push(h1.id, h2.id);

    const post = async (path: string, body: unknown, t = tA) => (await call('POST', path, { token: t, body })).json;
    const turma = await post('/turmas', { nome: `${PREFIXO} 9A`, serie: '9º Ano' });
    const turmaB = await post('/turmas', { nome: `${PREFIXO} 9B`, serie: '9º Ano' }, tB);
    const mat = await post('/disciplinas', { nome: `${PREFIXO} Física` });

    const rotina = (itens: unknown, t = tA) => call('PUT', '/agenda/rotina', { token: t, body: { itens } });
    const excecoes = (itens: unknown, t = tA) => call('PUT', '/agenda/excecoes', { token: t, body: { itens } });
    const verRotina = async (query = '', t = tA) => (await call('GET', `/agenda/rotina${query}`, { token: t })).json as Rotina[];
    const verExcecoes = async (query = '', t = tA) => (await call('GET', `/agenda/excecoes${query}`, { token: t })).json as Excecao[];

    console.log('\n— Rotina da semana —');
    const r1 = await rotina([{ dia_semana: 1, horario_grade_id: h1.id, turma_id: turma.id, disciplina_id: mat.id, cor: 'azul' }]);
    const it1 = r1.json?.[0] as Rotina;
    check(r1.status === 200 && it1.user_id === profA.id && it1.dia_semana === 1 && it1.turma_id === turma.id && it1.cor === 'azul', 'Professor grava a aula de segunda na 1ª aula');
    const rep = await rotina([2, 3, 4, 5].map((d) => ({ dia_semana: d, horario_grade_id: h1.id, turma_id: turma.id, disciplina_id: mat.id })));
    check(rep.status === 200 && rep.json.length === 4, '"Replicar segunda para a semana" numa ida só');
    await rotina([{ dia_semana: 1, horario_grade_id: h1.id, turma_id: null, atividade: 'Planejamento' }]);
    const seg = (await verRotina()).find((r) => r.dia_semana === 1)!;
    check(seg.id === it1.id && seg.turma_id === null && seg.atividade === 'Planejamento' && seg.disciplina_id === mat.id, 'Corrigir atualiza o mesmo item; só muda o enviado');
    check((await verRotina()).length === 5, 'Lista a rotina (5 dias)');
    check(codigo(await rotina([{ dia_semana: 7, horario_grade_id: h1.id }])) === 'DADOS_INVALIDOS', 'Dia da semana 7 → erro de dados');
    check(codigo(await rotina([{ dia_semana: 1, horario_grade_id: INEXISTENTE }])) === 'HORARIO_INVALIDO', 'Horário da grade inexistente → horário inválido');
    check(codigo(await rotina([{ dia_semana: 1, horario_grade_id: h2.id, turma_id: turmaB.id }])) === 'TURMA_INVALIDA', 'Turma de outro professor → turma inválida');
    check(
      codigo(await rotina([{ dia_semana: 1, horario_grade_id: h2.id }, { dia_semana: 1, horario_grade_id: h2.id }])) === 'DADOS_INVALIDOS',
      'O mesmo dia e horário duas vezes → erro de dados',
    );
    const misto = await rotina([{ dia_semana: 6, horario_grade_id: h2.id, atividade: 'Sábado' }, { dia_semana: 0, horario_grade_id: INEXISTENTE }]);
    check(codigo(misto) === 'HORARIO_INVALIDO' && (await verRotina()).length === 5, 'Um item errado → nenhum entra');
    check(codigo(await rotina([])) === 'DADOS_INVALIDOS', 'Lista vazia → erro de dados');

    check((await verRotina('', tB)).length === 0, 'Professor B vê só a própria agenda (vazia)');
    check(codigo(await call('GET', `/agenda/rotina?user_id=${profA.id}`, { token: tB })) === 'AGENDA_NAO_ENCONTRADA', 'Professor B não vê a agenda do A');
    check((await verRotina(`?user_id=${profA.id}`, tCoord)).length === 5, 'Gestão vê a agenda de um professor');
    await rotina([{ dia_semana: 1, horario_grade_id: h1.id, atividade: 'Da coordenação' }], tCoord);
    check((await verRotina()).find((r) => r.dia_semana === 1)?.atividade === 'Planejamento', 'O que a gestão grava vai para a agenda dela, não para a do professor');

    check(codigo(await call('DELETE', `/agenda/rotina/${it1.id}`, { token: tB })) === 'AGENDA_NAO_ENCONTRADA', 'Professor B não limpa a agenda do A');
    check(codigo(await call('DELETE', `/agenda/rotina/${it1.id}`, { token: tCoord })) === 'SEM_PERMISSAO', 'Gestão não limpa');
    check((await call('DELETE', `/agenda/rotina/${it1.id}`, { token: tA })).status === 204 && (await verRotina()).length === 4, 'Dono limpa uma célula');
    const sexta = (await verRotina()).find((r) => r.dia_semana === 5)!;
    check((await call('DELETE', `/agenda/rotina/${sexta.id}`, { token: tAdmin })).status === 204, 'Admin limpa');

    console.log('\n— Exceções de um dia —');
    const e1 = await excecoes([{ data: '2026-11-09', horario_grade_id: h1.id, atividade: 'Reposição', turma_id: turma.id, observacao: 'Sala 3' }]);
    const ex1 = e1.json?.[0] as Excecao;
    check(e1.status === 200 && ex1.data === '2026-11-09' && ex1.cancelado === false && ex1.atividade === 'Reposição' && ex1.observacao === 'Sala 3', 'Muda a aula de um dia (data AAAA-MM-DD)');
    const canc = await excecoes([{ data: '2026-11-09', horario_grade_id: h1.id, cancelado: true }]);
    check(canc.json?.[0]?.id === ex1.id && canc.json[0].cancelado === true, 'Cancelar a aula naquele dia corrige a mesma exceção');
    const ano = Array.from({ length: 8 }, (_, i) => ({ data: new Date(Date.UTC(2026, 10, 10 + 7 * i)).toISOString().slice(0, 10), horario_grade_id: h2.id, atividade: 'Clube' }));
    check((await excecoes(ano)).json?.length === 8, '"Até o fim do ano": várias datas de uma vez');
    check((await verExcecoes('?de=2026-11-09&ate=2026-11-30')).length === 4, 'Lista as exceções de um período');
    check(codigo(await excecoes([{ data: '2026-02-30', horario_grade_id: h1.id }])) === 'DADOS_INVALIDOS', 'Data impossível → erro de dados');
    check(codigo(await excecoes([{ horario_grade_id: h1.id }])) === 'DADOS_INVALIDOS', 'Sem data → erro de dados');
    check(codigo(await excecoes([{ data: '2026-11-09', horario_grade_id: h1.id, cancelado: 'sim' }])) === 'DADOS_INVALIDOS', '"cancelado" que não é sim/não → erro de dados');
    check(codigo(await call('GET', '/agenda/excecoes?de=09/11/2026', { token: tA })) === 'DADOS_INVALIDOS', 'Data malformada no filtro → erro de dados');
    check((await verExcecoes('', tB)).length === 0 && (await verExcecoes(`?user_id=${profA.id}`, tCoord)).length === 9, 'Professor B não vê; gestão vê');
    check(codigo(await call('DELETE', `/agenda/excecoes/${ex1.id}`, { token: tCoord })) === 'SEM_PERMISSAO', 'Gestão não desfaz exceção');
    check((await call('DELETE', `/agenda/excecoes/${ex1.id}`, { token: tA })).status === 204 && (await verExcecoes()).length === 8, 'Dono desfaz: o dia volta à rotina');
    check((await call('PUT', '/agenda/excecoes', { body: { itens: [] } })).status === 401, 'Sem login não grava');
  } finally {
    server.close();
    // Turmas primeiro; os usuários levam a agenda; por fim os horários do teste.
    const turmas = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    await prisma.horario_grade.deleteMany({ where: { id: { in: horarios } } });
    console.log(`\n🧹 ${count} usuários de teste, ${turmas.count} turmas e ${horarios.length} horários de teste apagados.`);
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
