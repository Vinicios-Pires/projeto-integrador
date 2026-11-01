/**
 * Conferência da Fase 5, Parte 1: diário de classe (atividades, lançamentos e observação por
 * aluno), com o padrão A. Cria usuários de teste temporários (e-mails `teste-diario-*`), turmas,
 * alunos e matérias, testa via HTTP e apaga tudo ao final.
 *
 * Uso: npm run test:diario
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

const PREFIXO = `teste-diario-${Date.now()}`;
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

type Atividade = { id: string; nome: string; user_id: string; tipo: string; peso: number; data: string | null; ordem: number; bimestre: number; categoria: string | null };
type Lanc = { atividade_id: string; aluno_id: string; valor: string | null; user_id: string; fez: boolean | null };

async function main() {
  const server = app.listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  const ids: string[] = [];

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

    const post = async (path: string, body: unknown, t = tA) => (await call('POST', path, { token: t, body })).json;
    const turma = await post('/turmas', { nome: `${PREFIXO} 6C`, serie: '6º Ano' });
    const turmaB = await post('/turmas', { nome: `${PREFIXO} 6D`, serie: '6º Ano' }, tB);
    const mat = await post('/disciplinas', { nome: `${PREFIXO} Ciências` });
    const matB = await post('/disciplinas', { nome: `${PREFIXO} Arte` }, tB);
    const [a1, a2] = await Promise.all(['Ana', 'Bia'].map((nome) => post('/alunos', { nome, turma_id: turma.id })));
    const b1 = await post('/alunos', { nome: 'Davi', turma_id: turmaB.id }, tB);

    const criar = (body: object, t = tA) => call('POST', '/diario/atividades', { token: t, body: { turma_id: turma.id, disciplina_id: mat.id, bimestre: 1, ...body } });
    const editar = (id: string, body: unknown, t = tA) => call('PATCH', `/diario/atividades/${id}`, { token: t, body });
    const atividades = async (query: string, t = tA) => (await call('GET', `/diario/atividades?${query}`, { token: t })).json as Atividade[];
    const lancar = (lancamentos: unknown, t = tA) => call('PUT', '/diario/lancamentos', { token: t, body: { lancamentos } });
    const lancs = async (query: string, t = tA) => (await call('GET', `/diario/lancamentos?${query}`, { token: t })).json as Lanc[];
    const obs = (body: object, t = tA) => call('PUT', '/diario/observacoes', { token: t, body: { turma_id: turma.id, disciplina_id: mat.id, bimestre: 1, ...body } });

    console.log('\n— Atividades —');
    const c1 = await criar({ nome: 'Caderno', categoria: 'Caderno', data: '2026-03-10' });
    const at1 = c1.json as Atividade;
    check(c1.status === 201 && at1.user_id === profA.id && at1.tipo === 'nota' && at1.peso === 1 && at1.ordem === 0, 'Professor cria a atividade (nota, peso 1, primeira coluna)');
    check(at1.data === '2026-03-10' && at1.categoria === 'Caderno', 'Data AAAA-MM-DD e categoria');
    const c2 = await criar({ nome: 'Participação', tipo: 'conceito', peso: 0.5 });
    check(c2.json?.ordem === 1 && c2.json.tipo === 'conceito' && c2.json.peso === 0.5, 'A segunda vai para o fim; conceito com peso 0,5');
    check(codigo(await criar({})) === 'DADOS_INVALIDOS', 'Sem nome → erro de dados');
    check(codigo(await criar({ nome: 'X', turma_id: undefined })) === 'DADOS_INVALIDOS', 'Sem turma → erro de dados');
    check(codigo(await criar({ nome: 'X', tipo: 'letra' })) === 'DADOS_INVALIDOS', 'Tipo inventado → erro de dados');
    check(codigo(await criar({ nome: 'X', peso: 0 })) === 'DADOS_INVALIDOS', 'Peso zero → erro de dados');
    check(codigo(await criar({ nome: 'X', turma_id: turmaB.id })) === 'TURMA_INVALIDA', 'Turma de outro professor → turma inválida');
    check(codigo(await criar({ nome: 'X', disciplina_id: matB.id })) === 'DISCIPLINA_INVALIDA', 'Matéria de outro professor → matéria inválida');
    const lista = await atividades(`turma_id=${turma.id}&disciplina_id=${mat.id}&bimestre=1`);
    check(lista.map((a) => a.nome).join(',') === 'Caderno,Participação', 'Lista as atividades da turma, matéria e bimestre, na ordem');
    check((await atividades(`turma_id=${turma.id}`, tB)).length === 0 && (await atividades(`turma_id=${turma.id}`, tCoord)).length === 2, 'Professor B não vê; gestão vê');
    check((await editar(at1.id, { nome: 'Caderno (visto)', peso: 2 })).json?.peso === 2, 'Dono altera nome e peso');
    check(codigo(await editar(at1.id, { turma_id: turma.id })) === 'DADOS_INVALIDOS', 'Trocar a turma → recusado');
    check(codigo(await editar(at1.id, { nome: 'X' }, tB)) === 'ATIVIDADE_NAO_ENCONTRADA', 'Professor B não altera');
    check(codigo(await editar(at1.id, { nome: 'X' }, tCoord)) === 'SEM_PERMISSAO', 'Gestão não altera');
    check((await editar(at1.id, { observacao: 'pelo admin' }, tAdmin)).json?.observacao === 'pelo admin', 'Admin altera');
    const ord = await call('PUT', '/diario/atividades/ordem', { token: tA, body: { ids: [c2.json.id, at1.id] } });
    check(ord.status === 200 && (await atividades(`turma_id=${turma.id}`)).map((a) => a.nome).join(',') === 'Participação,Caderno (visto)', 'Reordena as colunas');

    console.log('\n— Lançamentos —');
    const l1 = await lancar([
      { atividade_id: at1.id, aluno_id: a1.id, valor: '8,5' },
      { atividade_id: at1.id, aluno_id: a2.id, valor: ' 7 ' },
      { atividade_id: c2.json.id, aluno_id: a1.id, valor: 'MB' },
    ]);
    check(l1.status === 200 && l1.json.salvos.length === 3 && l1.json.apagados === 0, 'Lança várias células de uma vez (como colar do Excel)');
    check(l1.json.salvos[0].valor === '8,5' && l1.json.salvos[1].valor === '7' && l1.json.salvos[0].user_id === profA.id, 'Guarda o valor como digitado (sem espaços), no nome do professor');
    await lancar([{ atividade_id: at1.id, aluno_id: a1.id, valor: '9' }]);
    check((await prisma.diario_lancamentos.count({ where: { atividade_id: at1.id, aluno_id: a1.id } })) === 1, 'Corrigir uma célula não duplica');
    const vazia = await lancar([{ atividade_id: at1.id, aluno_id: a2.id, valor: '' }]);
    check(vazia.json?.apagados === 1, 'Célula vazia apaga o lançamento');
    check((await lancar([{ atividade_id: at1.id, aluno_id: a2.id, valor: null, fez: true }])).json?.salvos?.[0]?.fez === true, 'Marca "fez" mesmo sem valor');
    check(codigo(await lancar([{ atividade_id: at1.id, aluno_id: a1.id, valor: 'x'.repeat(31) }])) === 'DADOS_INVALIDOS', 'Valor longo demais → erro de dados');
    check(codigo(await lancar([{ atividade_id: at1.id, aluno_id: a1.id, valor: 8 }])) === 'DADOS_INVALIDOS', 'Valor que não é texto → erro de dados');
    check(codigo(await lancar([])) === 'DADOS_INVALIDOS', 'Lista vazia → erro de dados');
    check(codigo(await lancar([{ atividade_id: at1.id, aluno_id: b1.id, valor: '5' }])) === 'ALUNO_FORA_DA_TURMA', 'Aluno de outra turma → fora da turma');
    check(codigo(await lancar([{ atividade_id: at1.id, aluno_id: INEXISTENTE, valor: '5' }])) === 'ALUNO_INVALIDO', 'Aluno inexistente → aluno inválido');
    const misto = await lancar([{ atividade_id: c2.json.id, aluno_id: a2.id, valor: 'B' }, { atividade_id: at1.id, aluno_id: b1.id, valor: '5' }]);
    check(codigo(misto) === 'ALUNO_FORA_DA_TURMA' && (await prisma.diario_lancamentos.count({ where: { atividade_id: c2.json.id, aluno_id: a2.id } })) === 0, 'Uma célula errada no lote → nenhuma entra');
    check(codigo(await lancar([{ atividade_id: at1.id, aluno_id: a1.id, valor: '5' }], tB)) === 'ATIVIDADE_NAO_ENCONTRADA', 'Professor B não lança');
    check(codigo(await lancar([{ atividade_id: at1.id, aluno_id: a1.id, valor: '5' }], tCoord)) === 'SEM_PERMISSAO', 'Gestão não lança');
    check((await lancar([{ atividade_id: at1.id, aluno_id: a1.id, valor: '10' }], tAdmin)).json?.salvos?.[0]?.user_id === profA.id, 'Admin lança; fica no nome do professor');
    check((await lancs(`atividade_id=${at1.id},${c2.json.id}`)).length === 3, 'Lista os lançamentos das atividades da planilha');
    check((await lancs(`atividade_id=${at1.id}`, tB)).length === 0 && (await lancs(`atividade_id=${at1.id}`, tCoord)).length === 2, 'Professor B não vê; gestão vê');

    console.log('\n— Observação do aluno —');
    const o1 = await obs({ aluno_id: a1.id, observacao: 'Participa bem' });
    check(o1.status === 200 && o1.json.observacao === 'Participa bem' && o1.json.user_id === profA.id, 'Professor escreve a observação do aluno no bimestre');
    await obs({ aluno_id: a1.id, observacao: 'Participa muito bem' });
    check((await prisma.diario_observacoes_aluno.count({ where: { aluno_id: a1.id } })) === 1, 'Corrigir não duplica');
    const listaObs = (await call('GET', `/diario/observacoes?turma_id=${turma.id}&bimestre=1`, { token: tCoord })).json;
    check(listaObs.length === 1 && listaObs[0].observacao === 'Participa muito bem', 'Gestão vê as observações');
    check((await call('GET', `/diario/observacoes?turma_id=${turma.id}`, { token: tB })).json.length === 0, 'Professor B não vê');
    check(codigo(await obs({ aluno_id: a1.id, observacao: 'X' }, tCoord)) === 'SEM_PERMISSAO', 'Gestão não escreve');
    check(codigo(await obs({ aluno_id: b1.id, observacao: 'X' })) === 'ALUNO_FORA_DA_TURMA', 'Aluno de outra turma → fora da turma');
    check(codigo(await obs({ aluno_id: a1.id })) === 'DADOS_INVALIDOS', 'Sem a observação → erro de dados');
    check((await obs({ aluno_id: a1.id, observacao: '' })).status === 204 && (await prisma.diario_observacoes_aluno.count({ where: { aluno_id: a1.id } })) === 0, 'Observação vazia apaga');

    console.log('\n— Excluir atividade —');
    check(codigo(await call('DELETE', `/diario/atividades/${at1.id}`, { token: tCoord })) === 'SEM_PERMISSAO', 'Gestão não exclui');
    check((await call('DELETE', `/diario/atividades/${at1.id}`, { token: tA })).status === 204, 'Dono exclui');
    check(
      (await prisma.diario_lancamentos.count({ where: { atividade_id: at1.id } })) === 0 && (await prisma.diario_lancamentos.count({ where: { atividade_id: c2.json.id } })) === 1,
      'Os lançamentos dela saem junto; os das outras ficam',
    );
  } finally {
    server.close();
    // Apagar as turmas leva alunos, atividades, lançamentos e observações.
    const turmas = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    console.log(`\n🧹 ${turmas.count} turmas (com o diário) e ${count} usuários de teste apagados.`);
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
