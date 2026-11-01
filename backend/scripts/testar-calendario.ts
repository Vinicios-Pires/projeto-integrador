/**
 * Conferência da Fase 2, Parte 5: grade de horários e ano letivo (padrão C: todo usuário
 * logado lê, só o admin altera). Cria usuários de teste temporários (e-mails
 * `teste-calendario-*`), uma faixa de horário de teste (rótulo com o mesmo prefixo) e anos
 * letivos de teste (2097 e 2098), testa via HTTP e apaga tudo ao final. Não altera a grade
 * nem o ano letivo reais (do seed), nem o admin real.
 *
 * Uso: npm run test:calendario
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

const PREFIXO = `teste-calendario-${Date.now()}`;
const SENHA = 'SenhaDeTeste123';
const email = (nome: string) => `${PREFIXO}-${nome}@prof.educacao.sp.gov.br`;
const INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const ANOS_TESTE = [2097, 2098];

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

type Horario = { id: string; ordem: number; rotulo: string; hora_inicio: string; hora_fim: string; tipo: string };

async function main() {
  const server = app.listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;

  async function call(method: string, path: string, { body, token }: { body?: unknown; token?: string } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, text, json: text ? JSON.parse(text) : null };
  }
  const token = async (nome: string) =>
    (await call('POST', '/auth/login', { body: { email: email(nome), senha: SENHA } })).json.token as string;
  const codigo = (r: { json: { error?: { code: string } } | null }) => r.json?.error?.code;

  const gradeAntes = await prisma.horario_grade.findMany({ orderBy: { id: 'asc' } });
  const anosAntes = await prisma.ano_letivo.findMany({ orderBy: { id: 'asc' } });
  if (await prisma.ano_letivo.count({ where: { ano: { in: ANOS_TESTE } } })) {
    throw new Error(`Os anos ${ANOS_TESTE.join(' e ')} já existem no banco; a conferência não vai mexer neles.`);
  }

  try {
    await criarUsuario('admin', 'admin');
    await criarUsuario('coord', 'coordenador');
    const prof = await criarUsuario('prof', 'professor');
    const tAdmin = await token('admin');
    const tCoord = await token('coord');
    const tProf = await token('prof');

    console.log('\n— Grade de horários —');
    const lista = await call('GET', '/horario-grade', { token: tProf });
    check(lista.status === 200 && lista.json.length === gradeAntes.length, 'Professor lê a grade inteira');
    const ordens = (lista.json as Horario[]).map((h) => h.ordem);
    check(ordens.every((o, i) => i === 0 || o >= ordens[i - 1]), 'Em ordem do dia');
    check(lista.json.length === 0 || /^\d{2}:\d{2}:\d{2}$/.test(lista.json[0].hora_inicio), 'Horários no formato HH:MM:SS (como o Supabase)');
    check((await call('GET', '/horario-grade')).status === 401, 'Sem login não lê');

    const novo = { ordem: 99, rotulo: `${PREFIXO} Extra`, hora_inicio: '18:00', hora_fim: '18:50' };
    const h = await call('POST', '/horario-grade', { token: tAdmin, body: novo });
    check(h.status === 201 && h.json.hora_inicio === '18:00:00' && h.json.tipo === 'aula', 'Admin cria uma faixa (tipo padrão: aula)');
    check(codigo(await call('POST', '/horario-grade', { token: tCoord, body: novo })) === 'SEM_PERMISSAO', 'Gestão não cria faixa');
    check(codigo(await call('POST', '/horario-grade', { token: tProf, body: novo })) === 'SEM_PERMISSAO', 'Professor não cria faixa');
    const criar = (body: object) => call('POST', '/horario-grade', { token: tAdmin, body: { ...novo, ...body } });
    check(codigo(await criar({ hora_inicio: '25:00' })) === 'DADOS_INVALIDOS', 'Horário impossível → erro de dados');
    check(codigo(await criar({ hora_fim: '17:00' })) === 'DADOS_INVALIDOS', 'Fim antes do início → erro de dados');
    check(codigo(await criar({ tipo: 'recreio' })) === 'DADOS_INVALIDOS', 'Tipo fora da lista → erro de dados');
    check(codigo(await criar({ rotulo: '' })) === 'DADOS_INVALIDOS', 'Sem rótulo → erro de dados');
    check(codigo(await criar({ ordem: null })) === 'DADOS_INVALIDOS', 'Sem ordem → erro de dados');
    check((await prisma.horario_grade.count({ where: { rotulo: novo.rotulo } })) === 1, 'Nada inválido foi gravado');

    const editar = (body: unknown, t = tAdmin) => call('PATCH', `/horario-grade/${h.json.id}`, { token: t, body });
    const e1 = await editar({ tipo: 'intervalo', hora_fim: '18:20' });
    check(e1.status === 200 && e1.json.tipo === 'intervalo' && e1.json.hora_fim === '18:20:00' && e1.json.hora_inicio === '18:00:00', 'Admin altera só o enviado');
    check(codigo(await editar({ hora_fim: '17:59' })) === 'DADOS_INVALIDOS', 'Alterar o fim para antes do início → erro de dados');
    check(codigo(await editar({})) === 'DADOS_INVALIDOS', 'Nada para alterar → erro de dados');
    check(codigo(await editar({ tipo: 'aula' }, tCoord)) === 'SEM_PERMISSAO', 'Gestão não altera');
    check(codigo(await call('PATCH', `/horario-grade/${INEXISTENTE}`, { token: tAdmin, body: { tipo: 'aula' } })) === 'HORARIO_NAO_ENCONTRADO', 'Faixa inexistente → não encontrada');
    check(codigo(await call('PATCH', '/horario-grade/xyz', { token: tAdmin, body: { tipo: 'aula' } })) === 'HORARIO_NAO_ENCONTRADO', 'Id malformado → não encontrada');
    check((await call('PATCH', '/horario-grade/xyz', { body: {} })).status === 401, 'Sem login → 401 (antes de olhar o id)');

    await prisma.agenda_professor.create({ data: { user_id: prof.id, dia_semana: 1, horario_grade_id: h.json.id, atividade: 'teste' } });
    const emUso = await call('DELETE', `/horario-grade/${h.json.id}`, { token: tAdmin });
    check(emUso.status === 409 && codigo(emUso) === 'HORARIO_EM_USO', 'Faixa usada na agenda de alguém não pode ser excluída');
    check((await prisma.agenda_professor.count({ where: { horario_grade_id: h.json.id } })) === 1, 'A agenda do professor continua intacta');
    await prisma.agenda_professor.deleteMany({ where: { horario_grade_id: h.json.id } });
    check(codigo(await call('DELETE', `/horario-grade/${h.json.id}`, { token: tCoord })) === 'SEM_PERMISSAO', 'Gestão não exclui');
    check((await call('DELETE', `/horario-grade/${h.json.id}`, { token: tAdmin })).status === 204, 'Admin exclui faixa sem uso');
    check(codigo(await call('DELETE', `/horario-grade/${h.json.id}`, { token: tAdmin })) === 'HORARIO_NAO_ENCONTRADO', 'Excluir de novo → não encontrada');

    console.log('\n— Ano letivo —');
    const anos = await call('GET', '/ano-letivo', { token: tProf });
    check(anos.status === 200 && anos.json.length === anosAntes.length, 'Professor lê os anos letivos');
    check(anos.json.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(anos.json[0].data_inicio), 'Datas no formato AAAA-MM-DD');
    check((await call('GET', '/ano-letivo')).status === 401, 'Sem login não lê');

    const anoBody = { ano: 2097, data_inicio: '2097-02-01', data_fim: '2097-12-15' };
    const a = await call('POST', '/ano-letivo', { token: tAdmin, body: anoBody });
    check(a.status === 201 && a.json.ativo === true && a.json.data_fim === '2097-12-15', 'Admin cria um ano letivo (ativo por padrão)');
    const lista2 = (await call('GET', '/ano-letivo', { token: tProf })).json as { ano: number }[];
    check(lista2[0]?.ano === 2097, 'Mais recente primeiro');
    check(codigo(await call('POST', '/ano-letivo', { token: tAdmin, body: anoBody })) === 'ANO_LETIVO_DUPLICADO', 'O mesmo ano duas vezes → duplicado');
    check(codigo(await call('POST', '/ano-letivo', { token: tCoord, body: { ...anoBody, ano: 2098 } })) === 'SEM_PERMISSAO', 'Gestão não cria');
    const criarAno = (body: object) => call('POST', '/ano-letivo', { token: tAdmin, body: { ...anoBody, ano: 2098, ...body } });
    check(codigo(await criarAno({ data_fim: '2098-01-01', data_inicio: '2098-02-01' })) === 'DADOS_INVALIDOS', 'Fim antes do início → erro de dados');
    check(codigo(await criarAno({ data_inicio: '01/02/2098' })) === 'DADOS_INVALIDOS', 'Data em outro formato → erro de dados');
    check(codigo(await criarAno({ ano: 1990 })) === 'DADOS_INVALIDOS', 'Ano fora do intervalo → erro de dados');
    check(codigo(await criarAno({ data_fim: undefined })) === 'DADOS_INVALIDOS', 'Sem data de fim → erro de dados');
    check((await prisma.ano_letivo.count({ where: { ano: 2098 } })) === 0, 'Nada inválido foi gravado');

    const editarAno = (body: unknown, t = tAdmin) => call('PATCH', `/ano-letivo/${a.json.id}`, { token: t, body });
    const ea = await editarAno({ ativo: false });
    check(ea.status === 200 && ea.json.ativo === false && ea.json.ano === 2097, 'Admin desativa o ano (só o enviado muda)');
    check(codigo(await editarAno({ data_fim: '2097-01-01' })) === 'DADOS_INVALIDOS', 'Fim antes do início → erro de dados');
    const real = anosAntes[0];
    if (real) check(codigo(await editarAno({ ano: real.ano })) === 'ANO_LETIVO_DUPLICADO', 'Trocar para um ano que já existe → duplicado');
    else check(true, 'Trocar para um ano que já existe → duplicado (sem ano real para comparar)');
    check(codigo(await editarAno({ ativo: true }, tProf)) === 'SEM_PERMISSAO', 'Professor não altera');
    check(codigo(await call('PATCH', `/ano-letivo/${INEXISTENTE}`, { token: tAdmin, body: { ativo: true } })) === 'ANO_LETIVO_NAO_ENCONTRADO', 'Ano inexistente → não encontrado');
    check(codigo(await call('DELETE', `/ano-letivo/${a.json.id}`, { token: tCoord })) === 'SEM_PERMISSAO', 'Gestão não exclui');
    check((await call('DELETE', `/ano-letivo/${a.json.id}`, { token: tAdmin })).status === 204, 'Admin exclui');
    check(codigo(await call('DELETE', `/ano-letivo/${a.json.id}`, { token: tAdmin })) === 'ANO_LETIVO_NAO_ENCONTRADO', 'Excluir de novo → não encontrado');

    console.log('\n— Dados reais preservados —');
    const gradeDepois = await prisma.horario_grade.findMany({ orderBy: { id: 'asc' } });
    const anosDepois = await prisma.ano_letivo.findMany({ orderBy: { id: 'asc' } });
    check(JSON.stringify(gradeDepois) === JSON.stringify(gradeAntes), 'A grade de horários real ficou igual');
    check(JSON.stringify(anosDepois) === JSON.stringify(anosAntes), 'O ano letivo real ficou igual');
  } finally {
    server.close();
    const h = await prisma.horario_grade.deleteMany({ where: { rotulo: { startsWith: PREFIXO } } });
    const a = await prisma.ano_letivo.deleteMany({ where: { ano: { in: ANOS_TESTE } } });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    console.log(`\n🧹 ${h.count} faixas, ${a.count} anos letivos e ${count} usuários de teste apagados.`);
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
