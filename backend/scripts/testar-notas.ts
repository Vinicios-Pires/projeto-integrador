/**
 * Conferência da Fase 4, Parte 1: avaliações (colunas da planilha de notas) e notas, com o
 * padrão A (dono lança, gestão só vê, admin pode tudo). Cria usuários de teste temporários
 * (e-mails `teste-notas-*`), turmas, alunos e matérias, testa via HTTP e apaga tudo ao final.
 *
 * Uso: npm run test:notas
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

const PREFIXO = `teste-notas-${Date.now()}`;
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

type Tipo = { id: string; nome: string; ordem: number; peso: number; bimestre: number; categoria: string; user_id: string };
type Nota = { aluno_id: string; tipo_avaliacao_id: string; nota: number; bimestre: number; user_id: string; tipos_avaliacao: { nome: string; peso: number } };

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
    const turma = await post('/turmas', { nome: `${PREFIXO} 7A`, serie: '7º Ano' });
    const eletiva = await post('/turmas', { nome: `${PREFIXO} Robótica`, serie: 'EM', tipo: 'personalizada' });
    const turmaB = await post('/turmas', { nome: `${PREFIXO} 8B`, serie: '8º Ano' }, tB);
    const mat = await post('/disciplinas', { nome: `${PREFIXO} Matemática` });
    const matB = await post('/disciplinas', { nome: `${PREFIXO} História` }, tB);
    const [a1, a2, a3] = await Promise.all(['Ana', 'Bia', 'Caio'].map((nome) => post('/alunos', { nome, turma_id: turma.id })));
    const b1 = await post('/alunos', { nome: 'Davi', turma_id: turmaB.id }, tB);
    await call('PUT', `/turmas/${eletiva.id}/membros`, { token: tA, body: { aluno_ids: [b1.id] } });

    const criarTipo = (body: object, t = tA) =>
      call('POST', '/tipos-avaliacao', { token: t, body: { turma_id: turma.id, disciplina_id: mat.id, bimestre: 1, ...body } });
    const editarTipo = (id: string, body: unknown, t = tA) => call('PATCH', `/tipos-avaliacao/${id}`, { token: t, body });
    const lancar = (notas: unknown, t = tA) => call('PUT', '/notas', { token: t, body: { notas } });
    const notas = async (query: string, t = tA) => (await call('GET', `/notas?${query}`, { token: t })).json as Nota[];
    const tipos = async (query: string, t = tA) => (await call('GET', `/tipos-avaliacao?${query}`, { token: t })).json as Tipo[];
    const daTurma = `turma_id=${turma.id}&disciplina_id=${mat.id}&bimestre=1`;

    console.log('\n— Avaliações —');
    const t1 = await criarTipo({ nome: 'Prova 1', peso: 2 });
    check(t1.status === 201 && t1.json.user_id === profA.id && t1.json.ordem === 1 && t1.json.categoria === 'normal', 'Professor cria a primeira avaliação (ordem 1, categoria normal)');
    check(t1.json?.peso === 2 && typeof t1.json?.peso === 'number', 'O peso sai como número (como o Supabase), não como texto');
    const t2 = await criarTipo({ nome: 'Prova Paulista', peso: 0.5, categoria: 'prova_paulista' });
    check(t2.json?.ordem === 2 && t2.json?.peso === 0.5 && t2.json?.categoria === 'prova_paulista', 'A segunda vai para o fim; marca de Prova Paulista');
    check(codigo(await criarTipo({})) === 'DADOS_INVALIDOS', 'Sem nome → erro de dados');
    check(codigo(await criarTipo({ nome: 'X', turma_id: undefined })) === 'DADOS_INVALIDOS', 'Sem turma → erro de dados');
    check(codigo(await criarTipo({ nome: 'X', turma_id: turmaB.id })) === 'TURMA_INVALIDA', 'Turma de outro professor → turma inválida');
    check(codigo(await criarTipo({ nome: 'X', disciplina_id: matB.id })) === 'DISCIPLINA_INVALIDA', 'Matéria de outro professor → matéria inválida');
    check(codigo(await criarTipo({ nome: 'X', bimestre: 5 })) === 'DADOS_INVALIDOS', 'Bimestre 5 → erro de dados');
    check(codigo(await criarTipo({ nome: 'X', peso: 0 })) === 'DADOS_INVALIDOS', 'Peso zero → erro de dados');
    check(codigo(await criarTipo({ nome: 'X', peso: '2' })) === 'DADOS_INVALIDOS', 'Peso em texto → erro de dados');
    check(codigo(await criarTipo({ nome: 'X', categoria: 'outra' })) === 'DADOS_INVALIDOS', 'Categoria inventada → erro de dados');
    check((await prisma.tipos_avaliacao.count({ where: { user_id: profA.id } })) === 2, 'Só as duas avaliações válidas foram gravadas');

    check(JSON.stringify((await tipos(daTurma)).map((t) => t.nome)) === JSON.stringify(['Prova 1', 'Prova Paulista']), 'Lista as avaliações da turma, matéria e bimestre, na ordem');
    check((await tipos(`turma_id=${turma.id}`, tB)).length === 0, 'Professor B não vê as avaliações do A');
    check((await tipos(`turma_id=${turma.id}`, tCoord)).length === 2, 'Gestão vê');
    check(codigo(await call('GET', '/tipos-avaliacao?bimestre=7', { token: tA })) === 'DADOS_INVALIDOS', 'Bimestre inválido no filtro → erro de dados');

    const e1 = await editarTipo(t1.json.id, { nome: 'Prova 1 (revisada)', peso: 3 });
    check(e1.status === 200 && e1.json.nome === 'Prova 1 (revisada)' && e1.json.peso === 3 && e1.json.categoria === 'normal', 'Dono altera nome e peso');
    check(codigo(await editarTipo(t1.json.id, { turma_id: eletiva.id })) === 'DADOS_INVALIDOS', 'Trocar a turma de uma avaliação → recusado');
    check(codigo(await editarTipo(t1.json.id, { peso: 1 }, tB)) === 'AVALIACAO_NAO_ENCONTRADA', 'Professor B não altera');
    check(codigo(await editarTipo(t1.json.id, { peso: 1 }, tCoord)) === 'SEM_PERMISSAO', 'Gestão vê, mas não altera');
    check((await editarTipo(t1.json.id, { descricao: 'pelo admin' }, tAdmin)).json?.descricao === 'pelo admin', 'Admin altera');
    check(codigo(await editarTipo(INEXISTENTE, { peso: 1 })) === 'AVALIACAO_NAO_ENCONTRADA', 'Avaliação inexistente → não encontrada');

    const ord = await call('PUT', '/tipos-avaliacao/ordem', { token: tA, body: { ids: [t2.json.id, t1.json.id] } });
    check(ord.status === 200 && JSON.stringify((await tipos(daTurma)).map((t) => t.nome)) === JSON.stringify(['Prova Paulista', 'Prova 1 (revisada)']), 'Reordena as colunas de uma vez');
    check(codigo(await call('PUT', '/tipos-avaliacao/ordem', { token: tA, body: { ids: [t1.json.id, t1.json.id] } })) === 'DADOS_INVALIDOS', 'Ordem com repetição → erro de dados');
    check(codigo(await call('PUT', '/tipos-avaliacao/ordem', { token: tB, body: { ids: [t1.json.id] } })) === 'AVALIACAO_NAO_ENCONTRADA', 'Professor B não reordena as do A');

    console.log('\n— Lançar notas —');
    const l1 = await lancar([
      { aluno_id: a1.id, tipo_avaliacao_id: t1.json.id, nota: 8.5 },
      { aluno_id: a2.id, tipo_avaliacao_id: t1.json.id, nota: 7 },
      { aluno_id: a1.id, tipo_avaliacao_id: t2.json.id, nota: 10 },
    ]);
    check(l1.status === 200 && l1.json.salvas.length === 3 && l1.json.apagadas === 0, 'Lança várias notas de uma vez');
    const n1 = l1.json.salvas[0] as Nota;
    check(n1.nota === 8.5 && n1.bimestre === 1 && n1.user_id === profA.id && n1.tipos_avaliacao.nome === 'Prova 1 (revisada)', 'Nota como número, bimestre e dono vindos da avaliação');
    await lancar([{ aluno_id: a1.id, tipo_avaliacao_id: t1.json.id, nota: 9 }]);
    const doA1 = await prisma.notas.findMany({ where: { aluno_id: a1.id, tipo_avaliacao_id: t1.json.id } });
    check(doA1.length === 1 && doA1[0].nota?.toNumber() === 9, 'Corrigir uma célula atualiza a mesma nota (não duplica)');
    const apaga = await lancar([{ aluno_id: a2.id, tipo_avaliacao_id: t1.json.id, nota: null }]);
    check(apaga.json?.apagadas === 1 && (await prisma.notas.count({ where: { aluno_id: a2.id } })) === 0, 'Nota vazia (null) apaga');

    check(codigo(await lancar([{ aluno_id: a1.id, tipo_avaliacao_id: t1.json.id, nota: 11 }])) === 'DADOS_INVALIDOS', 'Nota acima de 10 → erro de dados');
    check(codigo(await lancar([{ aluno_id: a1.id, tipo_avaliacao_id: t1.json.id, nota: -1 }])) === 'DADOS_INVALIDOS', 'Nota negativa → erro de dados');
    check(codigo(await lancar([{ aluno_id: a1.id, tipo_avaliacao_id: t1.json.id, nota: '8' }])) === 'DADOS_INVALIDOS', 'Nota em texto → erro de dados');
    check(codigo(await lancar([])) === 'DADOS_INVALIDOS', 'Lista vazia → erro de dados');
    check(
      codigo(await lancar([{ aluno_id: a3.id, tipo_avaliacao_id: t1.json.id, nota: 5 }, { aluno_id: a3.id, tipo_avaliacao_id: t1.json.id, nota: 6 }])) === 'DADOS_INVALIDOS',
      'O mesmo aluno duas vezes na mesma avaliação → erro de dados',
    );
    check(codigo(await lancar([{ aluno_id: INEXISTENTE, tipo_avaliacao_id: t1.json.id, nota: 5 }])) === 'ALUNO_INVALIDO', 'Aluno inexistente → aluno inválido');
    check(codigo(await lancar([{ aluno_id: b1.id, tipo_avaliacao_id: t1.json.id, nota: 5 }])) === 'ALUNO_FORA_DA_TURMA', 'Aluno de outra turma → fora da turma');
    check(codigo(await lancar([{ aluno_id: a3.id, tipo_avaliacao_id: INEXISTENTE, nota: 5 }])) === 'AVALIACAO_NAO_ENCONTRADA', 'Avaliação inexistente → não encontrada');
    const misto = await lancar([{ aluno_id: a3.id, tipo_avaliacao_id: t1.json.id, nota: 6 }, { aluno_id: b1.id, tipo_avaliacao_id: t1.json.id, nota: 5 }]);
    check(codigo(misto) === 'ALUNO_FORA_DA_TURMA' && (await prisma.notas.count({ where: { aluno_id: a3.id } })) === 0, 'Uma nota errada no lote → nenhuma entra');

    const tE = await call('POST', '/tipos-avaliacao', { token: tA, body: { nome: 'Projeto', turma_id: eletiva.id, disciplina_id: mat.id, bimestre: 1 } });
    check((await lancar([{ aluno_id: b1.id, tipo_avaliacao_id: tE.json.id, nota: 9.5 }])).status === 200, 'Na eletiva, o membro (de outra turma) recebe nota');
    check(codigo(await lancar([{ aluno_id: a3.id, tipo_avaliacao_id: tE.json.id, nota: 9 }])) === 'ALUNO_FORA_DA_TURMA', 'Quem não é membro da eletiva não recebe');

    check(codigo(await lancar([{ aluno_id: a3.id, tipo_avaliacao_id: t1.json.id, nota: 5 }], tB)) === 'AVALIACAO_NAO_ENCONTRADA', 'Professor B não lança na avaliação do A');
    check(codigo(await lancar([{ aluno_id: a3.id, tipo_avaliacao_id: t1.json.id, nota: 5 }], tCoord)) === 'SEM_PERMISSAO', 'Gestão não lança');
    const pelaAdmin = await lancar([{ aluno_id: a3.id, tipo_avaliacao_id: t1.json.id, nota: 6.5 }], tAdmin);
    check(pelaAdmin.status === 200 && pelaAdmin.json.salvas[0].user_id === profA.id, 'Admin lança; a nota fica no nome do professor dono');
    check((await call('PUT', '/notas', { body: { notas: [] } })).status === 401, 'Sem login não lança');

    console.log('\n— Ver notas —');
    const daAvaliacao = await notas(`tipo_avaliacao_id=${t1.json.id}`);
    check(daAvaliacao.length === 2 && daAvaliacao.every((n) => typeof n.nota === 'number'), 'Notas de uma avaliação');
    check((await notas(`aluno_id=${a1.id}`)).length === 2, 'Notas de um aluno');
    check((await notas(`tipo_avaliacao_id=${t1.json.id},${t2.json.id}&aluno_id=${a1.id},${a3.id}`)).length === 3, 'Vários alunos e avaliações (o que a planilha pede)');
    check((await notas(`turma_id=${turma.id}&disciplina_id=${mat.id}&bimestre=1`)).length === 3, 'Por turma, matéria e bimestre (o que os relatórios pedem)');
    check((await notas(`aluno_id=${a1.id}`))[0]?.tipos_avaliacao?.peso !== undefined, 'Cada nota traz a avaliação (nome e peso)');
    check((await notas(`turma_id=${turma.id}`, tB)).length === 0, 'Professor B não vê as notas do A');
    check((await notas(`turma_id=${turma.id}`, tCoord)).length === 3, 'Gestão vê');
    check(codigo(await call('GET', '/notas?aluno_id=abc', { token: tA })) === 'DADOS_INVALIDOS', 'Filtro malformado → erro de dados');

    await editarTipo(t1.json.id, { bimestre: 2 });
    check((await prisma.notas.findMany({ where: { tipo_avaliacao_id: t1.json.id } })).every((n) => n.bimestre === 2), 'Mudar o bimestre da avaliação leva junto o das notas');

    console.log('\n— Excluir avaliação —');
    check(codigo(await call('DELETE', `/tipos-avaliacao/${t1.json.id}`, { token: tB })) === 'AVALIACAO_NAO_ENCONTRADA', 'Professor B não exclui');
    check(codigo(await call('DELETE', `/tipos-avaliacao/${t1.json.id}`, { token: tCoord })) === 'SEM_PERMISSAO', 'Gestão não exclui');
    check((await call('DELETE', `/tipos-avaliacao/${t1.json.id}`, { token: tA })).status === 204, 'Dono exclui');
    check((await prisma.notas.count({ where: { tipo_avaliacao_id: t1.json.id } })) === 0, 'As notas da avaliação saem junto (a tela já avisa)');
    check((await prisma.notas.count({ where: { tipo_avaliacao_id: t2.json.id } })) === 1, 'As notas das outras avaliações ficam');
  } finally {
    server.close();
    // Apagar as turmas leva alunos, avaliações e notas; matérias saem com os usuários.
    const turmas = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    console.log(`\n🧹 ${turmas.count} turmas (com alunos, avaliações e notas) e ${count} usuários de teste apagados.`);
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
