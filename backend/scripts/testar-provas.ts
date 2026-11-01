/**
 * Conferência da Fase 4, Parte 3: provas e gabaritos (tela "Correção de Provas"), com o padrão A
 * (dono altera, gestão só vê, admin pode tudo). Cria usuários de teste temporários (e-mails
 * `teste-provas-*`), turmas e matérias, testa via HTTP e apaga tudo ao final.
 *
 * Uso: npm run test:provas
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

const PREFIXO = `teste-provas-${Date.now()}`;
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

type Prova = {
  id: string; titulo: string; user_id: string; turma_id: string | null; bimestre: number; numero_questoes: number;
  valor_total: number; data_aplicacao: string | null; turmas: { nome: string; serie: string } | null; disciplinas: { nome: string } | null;
};
type Questao = { numero_questao: number; resposta_correta: string; anulada: boolean; peso: number };

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
    const turma = await post('/turmas', { nome: `${PREFIXO} 9A`, serie: '9º Ano' });
    const turma2 = await post('/turmas', { nome: `${PREFIXO} 9B`, serie: '9º Ano' });
    const turmaB = await post('/turmas', { nome: `${PREFIXO} 8B`, serie: '8º Ano' }, tB);
    const mat = await post('/disciplinas', { nome: `${PREFIXO} Ciências` });
    const matB = await post('/disciplinas', { nome: `${PREFIXO} Geografia` }, tB);

    const criar = (body: object, t = tA) => call('POST', '/provas', { token: t, body });
    const editar = (id: string, body: unknown, t = tA) => call('PATCH', `/provas/${id}`, { token: t, body });
    const provas = async (query: string, t = tA) => (await call('GET', `/provas?${query}`, { token: t })).json as Prova[];
    const gabarito = (id: string, questoes: unknown, t = tA) => call('PUT', `/provas/${id}/gabarito`, { token: t, body: { questoes } });
    const verGabarito = async (id: string, t = tA) => (await call('GET', `/provas/${id}/gabarito`, { token: t })).json as Questao[];

    console.log('\n— Provas —');
    const p1 = await criar({ titulo: 'Avaliação 1', turma_id: turma.id, disciplina_id: mat.id, bimestre: 2, numero_questoes: 5, data_aplicacao: '2026-11-10', valor_total: 10 });
    const r1 = p1.json as Prova;
    check(p1.status === 201 && r1.user_id === profA.id && r1.numero_questoes === 5 && r1.bimestre === 2, 'Professor cria a prova (5 questões, 2º bimestre)');
    check(r1.valor_total === 10 && typeof r1.valor_total === 'number' && r1.data_aplicacao === '2026-11-10', 'Valor como número e data como AAAA-MM-DD');
    check(r1.turmas?.nome === `${PREFIXO} 9A` && r1.disciplinas?.nome === `${PREFIXO} Ciências`, 'Vem com o nome da turma e da matéria');
    const p2 = await criar({ titulo: 'Simulado sem turma' });
    check(p2.status === 201 && p2.json.turmas === null && p2.json.numero_questoes === 10 && p2.json.valor_total === 10 && p2.json.bimestre === 1, 'Sem turma e matéria, com os padrões (10 questões, valor 10, 1º bimestre)');
    check(codigo(await criar({})) === 'DADOS_INVALIDOS', 'Sem título → erro de dados');
    check(codigo(await criar({ titulo: 'X', numero_questoes: 0 })) === 'DADOS_INVALIDOS', 'Zero questões → erro de dados');
    check(codigo(await criar({ titulo: 'X', numero_questoes: 101 })) === 'DADOS_INVALIDOS', 'Mais de 100 questões → erro de dados');
    check(codigo(await criar({ titulo: 'X', valor_total: 0 })) === 'DADOS_INVALIDOS', 'Valor zero → erro de dados');
    check(codigo(await criar({ titulo: 'X', bimestre: 5 })) === 'DADOS_INVALIDOS', 'Bimestre 5 → erro de dados');
    check(codigo(await criar({ titulo: 'X', data_aplicacao: '2026-02-30' })) === 'DADOS_INVALIDOS', 'Data impossível → erro de dados');
    check(codigo(await criar({ titulo: 'X', turma_id: turmaB.id })) === 'TURMA_INVALIDA', 'Turma de outro professor → turma inválida');
    check(codigo(await criar({ titulo: 'X', disciplina_id: matB.id })) === 'DISCIPLINA_INVALIDA', 'Matéria de outro professor → matéria inválida');
    check((await prisma.provas.count({ where: { user_id: profA.id } })) === 2, 'Só as duas provas válidas foram gravadas');

    const minhas = await provas('');
    check(minhas.length === 2 && minhas[0].titulo === 'Simulado sem turma', 'Lista as provas, as mais novas primeiro');
    check((await provas(`turma_id=${turma.id}&bimestre=2`)).length === 1, 'Filtra por turma e bimestre');
    check((await provas('', tB)).length === 0, 'Professor B não vê as provas do A');
    check((await provas(`turma_id=${turma.id}`, tCoord)).length === 1, 'Gestão vê');
    check((await call('GET', `/provas/${r1.id}`, { token: tA })).json?.titulo === 'Avaliação 1', 'Abre uma prova');
    check(codigo(await call('GET', `/provas/${r1.id}`, { token: tB })) === 'PROVA_NAO_ENCONTRADA', 'Professor B não abre a prova do A');
    check(codigo(await call('GET', '/provas/abc', { token: tA })) === 'PROVA_NAO_ENCONTRADA', 'Id malformado → não encontrada');
    check(codigo(await call('GET', '/provas?bimestre=0', { token: tA })) === 'DADOS_INVALIDOS', 'Bimestre inválido no filtro → erro de dados');

    const e1 = await editar(r1.id, { titulo: 'Avaliação 1 (revisada)', valor_total: 5 });
    check(e1.status === 200 && e1.json.titulo === 'Avaliação 1 (revisada)' && e1.json.valor_total === 5 && e1.json.numero_questoes === 5, 'Dono altera título e valor (o resto fica)');
    check(codigo(await editar(r1.id, {})) === 'DADOS_INVALIDOS', 'Nada para alterar → erro de dados');
    check(codigo(await editar(r1.id, { titulo: 'X' }, tB)) === 'PROVA_NAO_ENCONTRADA', 'Professor B não altera');
    check(codigo(await editar(r1.id, { titulo: 'X' }, tCoord)) === 'SEM_PERMISSAO', 'Gestão vê, mas não altera');
    check((await editar(r1.id, { observacoes: 'pelo admin' }, tAdmin)).json?.observacoes === 'pelo admin', 'Admin altera');
    check(codigo(await editar(INEXISTENTE, { titulo: 'X' })) === 'PROVA_NAO_ENCONTRADA', 'Prova inexistente → não encontrada');

    console.log('\n— Gabarito —');
    const g1 = await gabarito(r1.id, [
      { numero_questao: 1, resposta_correta: 'A' },
      { numero_questao: 2, resposta_correta: 'C' },
      { numero_questao: 3, resposta_correta: 'E', anulada: true },
      { numero_questao: 4, resposta_correta: 'B', peso: 2 },
      { numero_questao: 5, resposta_correta: 'D' },
    ]);
    check(g1.status === 200 && g1.json.length === 5 && g1.json.map((q: Questao) => q.resposta_correta).join('') === 'ACEBD', 'Salva o gabarito das 5 questões, em ordem');
    check(g1.json[2].anulada === true && g1.json[0].anulada === false && g1.json[3].peso === 2 && g1.json[0].peso === 1, 'Questão anulada marcada; peso como número (padrão 1)');
    await gabarito(r1.id, [
      { numero_questao: 1, resposta_correta: 'B' },
      { numero_questao: 2, resposta_correta: 'C' },
      { numero_questao: 3, resposta_correta: 'E' },
      { numero_questao: 4, resposta_correta: 'B' },
    ]);
    const g2 = await verGabarito(r1.id);
    check(g2.length === 4 && g2[0].resposta_correta === 'B' && g2[2].anulada === false, 'Salvar de novo corrige (sem duplicar); a questão que não veio sai');
    check((await prisma.gabaritos.count({ where: { prova_id: r1.id } })) === 4, 'No banco ficou uma linha por questão');
    check(codigo(await gabarito(r1.id, [{ numero_questao: 6, resposta_correta: 'A' }])) === 'DADOS_INVALIDOS', 'Questão além do número da prova → erro de dados');
    check(codigo(await gabarito(r1.id, [{ numero_questao: 1, resposta_correta: 'F' }])) === 'DADOS_INVALIDOS', 'Alternativa F → erro de dados');
    check(codigo(await gabarito(r1.id, [{ numero_questao: 1, resposta_correta: 'a' }])) === 'DADOS_INVALIDOS', 'Alternativa minúscula → erro de dados');
    check(
      codigo(await gabarito(r1.id, [{ numero_questao: 1, resposta_correta: 'A' }, { numero_questao: 1, resposta_correta: 'B' }])) === 'DADOS_INVALIDOS',
      'A mesma questão duas vezes → erro de dados',
    );
    check(codigo(await call('PUT', `/provas/${r1.id}/gabarito`, { token: tA, body: {} })) === 'DADOS_INVALIDOS', 'Sem "questoes" → erro de dados');
    check((await verGabarito(r1.id)).length === 4, 'Gabarito com erro não muda nada');
    check(codigo(await gabarito(r1.id, [{ numero_questao: 1, resposta_correta: 'A' }], tB)) === 'PROVA_NAO_ENCONTRADA', 'Professor B não mexe no gabarito do A');
    check(codigo(await gabarito(r1.id, [{ numero_questao: 1, resposta_correta: 'A' }], tCoord)) === 'SEM_PERMISSAO', 'Gestão não mexe no gabarito');
    check((await verGabarito(r1.id, tCoord)).length === 4, 'Gestão vê o gabarito');
    check(codigo(await call('GET', `/provas/${r1.id}/gabarito`, { token: tB })) === 'PROVA_NAO_ENCONTRADA', 'Professor B não vê o gabarito do A');
    check((await call('GET', `/provas/${r1.id}/gabarito`)).status === 401, 'Sem login não vê');

    await editar(r1.id, { numero_questoes: 2 });
    check((await verGabarito(r1.id)).map((q) => q.numero_questao).join(',') === '1,2', 'Com menos questões, o gabarito das que sobram sai junto');

    // Uma resposta de aluno trava a troca de turma.
    const aluno = await post('/alunos', { nome: 'Eva', turma_id: turma.id });
    await prisma.resultados_prova.create({ data: { prova_id: r1.id, aluno_id: aluno.id, user_id: profA.id, respostas: {}, acertos: 0 } });
    check(codigo(await editar(r1.id, { turma_id: turma2.id })) === 'PROVA_COM_RESULTADOS', 'Com respostas de alunos, a turma não muda');
    check((await editar(p2.json.id, { turma_id: turma2.id })).json?.turmas?.nome === `${PREFIXO} 9B`, 'Sem respostas, dá para escolher a turma depois');

    console.log('\n— Excluir prova —');
    check(codigo(await call('DELETE', `/provas/${r1.id}`, { token: tB })) === 'PROVA_NAO_ENCONTRADA', 'Professor B não exclui');
    check(codigo(await call('DELETE', `/provas/${r1.id}`, { token: tCoord })) === 'SEM_PERMISSAO', 'Gestão não exclui');
    check((await call('DELETE', `/provas/${r1.id}`, { token: tA })).status === 204, 'Dono exclui');
    check(
      (await prisma.gabaritos.count({ where: { prova_id: r1.id } })) === 0 && (await prisma.resultados_prova.count({ where: { prova_id: r1.id } })) === 0,
      'O gabarito e as respostas saem junto',
    );
    check((await call('DELETE', `/provas/${p2.json.id}`, { token: tAdmin })).status === 204, 'Admin exclui');
  } finally {
    server.close();
    // Apagar os usuários leva as provas (e gabaritos); as turmas levam os alunos.
    const turmas = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    console.log(`\n🧹 ${turmas.count} turmas e ${count} usuários de teste (com provas e gabaritos) apagados.`);
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
