/**
 * Conferência da Fase 4, Parte 4: correção de provas (respostas de cada aluno, acertos e nota
 * calculados pelo backend a partir do gabarito), com o padrão A. Cria usuários de teste
 * temporários (e-mails `teste-correcao-*`), turmas, alunos e provas, testa via HTTP e apaga tudo.
 *
 * Uso: npm run test:correcao
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

const PREFIXO = `teste-correcao-${Date.now()}`;
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

type Resultado = {
  aluno_id: string; respostas: Record<string, string>; acertos: number; nota: number; ajuste_manual: boolean;
  user_id: string; observacoes: string | null; alunos: { nome: string; numero_chamada: number | null };
};

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
    const eletiva = await post('/turmas', { nome: `${PREFIXO} Xadrez`, serie: 'EM', tipo: 'personalizada' });
    const turmaB = await post('/turmas', { nome: `${PREFIXO} 8B`, serie: '8º Ano' }, tB);
    const a1 = await post('/alunos', { nome: 'Ana', turma_id: turma.id, numero_chamada: 1 });
    const a2 = await post('/alunos', { nome: 'Bia', turma_id: turma.id, numero_chamada: 2 });
    const a3 = await post('/alunos', { nome: 'Caio', turma_id: turma.id, numero_chamada: 3 });
    const b1 = await post('/alunos', { nome: 'Davi', turma_id: turmaB.id }, tB);
    await call('PUT', `/turmas/${eletiva.id}/membros`, { token: tA, body: { aluno_ids: [b1.id] } });

    // Prova de 4 questões valendo 10: cada acerto vale 2,5.
    const prova = await post('/provas', { titulo: 'Prova', turma_id: turma.id, numero_questoes: 4, valor_total: 10 });
    const semTurma = await post('/provas', { titulo: 'Sem turma', numero_questoes: 4 });
    const semGabarito = await post('/provas', { titulo: 'Sem gabarito', turma_id: turma.id, numero_questoes: 4 });
    const naEletiva = await post('/provas', { titulo: 'Eletiva', turma_id: eletiva.id, numero_questoes: 2 });
    const gab = (id: string, letras: string, anuladas: number[] = []) =>
      call('PUT', `/provas/${id}/gabarito`, {
        token: tA,
        body: { questoes: [...letras].map((l, i) => ({ numero_questao: i + 1, resposta_correta: l, anulada: anuladas.includes(i + 1) })) },
      });
    await gab(prova.id, 'ABCD');
    await gab(semTurma.id, 'ABCD');
    await gab(naEletiva.id, 'AA');

    const lancar = (id: string, resultados: unknown, t = tA) => call('PUT', `/provas/${id}/resultados`, { token: t, body: { resultados } });
    const resultados = async (id: string, t = tA) => (await call('GET', `/provas/${id}/resultados`, { token: t })).json as Resultado[];
    const doAluno = async (aluno: string) => (await resultados(prova.id)).find((r) => r.aluno_id === aluno)!;

    console.log('\n— Lançar respostas —');
    const l1 = await lancar(prova.id, [
      { aluno_id: a1.id, respostas: { 1: 'A', 2: 'B', 3: 'C', 4: 'D' } },
      { aluno_id: a2.id, respostas: { 1: 'A', 2: 'C', 3: '', 4: 'E' } },
    ]);
    check(l1.status === 200 && l1.json.length === 2, 'Lança as respostas de dois alunos de uma vez');
    const r1 = l1.json.find((r: Resultado) => r.aluno_id === a1.id) as Resultado;
    const r2 = l1.json.find((r: Resultado) => r.aluno_id === a2.id) as Resultado;
    check(r1.acertos === 4 && r1.nota === 10 && typeof r1.nota === 'number', 'O backend corrige: 4 acertos = nota 10 (como número)');
    check(r2.acertos === 1 && r2.nota === 2.5, '1 acerto em 4 = nota 2,5');
    check(JSON.stringify(r2.respostas) === JSON.stringify({ 1: 'A', 2: 'C', 4: 'E' }), 'Questão em branco não é guardada como resposta');
    check(r1.user_id === profA.id && r1.ajuste_manual === false && r1.alunos?.nome === 'Ana', 'No nome do professor, cálculo automático, com o nome do aluno');
    await lancar(prova.id, [{ aluno_id: a2.id, respostas: { 1: 'A', 2: 'B', 3: 'C', 4: 'E' } }]);
    check(
      (await prisma.resultados_prova.count({ where: { prova_id: prova.id, aluno_id: a2.id } })) === 1 && (await doAluno(a2.id)).nota === 7.5,
      'Lançar de novo corrige a mesma folha (sem duplicar)',
    );
    const manual = await lancar(prova.id, [{ aluno_id: a3.id, respostas: { 1: 'D' }, nota: 6, observacoes: 'Fez recuperação' }]);
    check(manual.json?.[0]?.nota === 6 && manual.json[0].acertos === 0 && manual.json[0].ajuste_manual === true, 'Nota informada à mão vale como ajuste manual (acertos continuam calculados)');
    check(manual.json?.[0]?.observacoes === 'Fez recuperação', 'Guarda a observação');

    check(codigo(await lancar(prova.id, [{ aluno_id: a1.id, respostas: { 5: 'A' } }])) === 'DADOS_INVALIDOS', 'Questão que a prova não tem → erro de dados');
    check(codigo(await lancar(prova.id, [{ aluno_id: a1.id, respostas: { 1: 'F' } }])) === 'DADOS_INVALIDOS', 'Alternativa F → erro de dados');
    check(codigo(await lancar(prova.id, [{ aluno_id: a1.id, respostas: ['A'] }])) === 'DADOS_INVALIDOS', 'Respostas em lista (e não por questão) → erro de dados');
    check(codigo(await lancar(prova.id, [{ aluno_id: a1.id, respostas: {}, nota: 11 }])) === 'DADOS_INVALIDOS', 'Nota maior que o valor da prova → erro de dados');
    check(codigo(await lancar(prova.id, [])) === 'DADOS_INVALIDOS', 'Lista vazia → erro de dados');
    check(
      codigo(await lancar(prova.id, [{ aluno_id: a1.id, respostas: {} }, { aluno_id: a1.id, respostas: {} }])) === 'DADOS_INVALIDOS',
      'O mesmo aluno duas vezes → erro de dados',
    );
    check(codigo(await lancar(prova.id, [{ aluno_id: INEXISTENTE, respostas: {} }])) === 'ALUNO_INVALIDO', 'Aluno inexistente → aluno inválido');
    check(codigo(await lancar(prova.id, [{ aluno_id: b1.id, respostas: {} }])) === 'ALUNO_FORA_DA_TURMA', 'Aluno de outra turma → fora da turma');
    const misto = await lancar(prova.id, [{ aluno_id: a1.id, respostas: { 1: 'B' } }, { aluno_id: b1.id, respostas: {} }]);
    check(codigo(misto) === 'ALUNO_FORA_DA_TURMA' && (await doAluno(a1.id)).respostas['1'] === 'A', 'Um aluno errado no lote → nada muda');
    check((await lancar(naEletiva.id, [{ aluno_id: b1.id, respostas: { 1: 'A', 2: 'A' } }])).json?.[0]?.nota === 10, 'Na eletiva, o membro (de outra turma) é corrigido');
    check(codigo(await lancar(semTurma.id, [{ aluno_id: a1.id, respostas: {} }])) === 'PROVA_SEM_TURMA', 'Prova sem turma → escolher a turma antes');
    check(codigo(await lancar(semGabarito.id, [{ aluno_id: a1.id, respostas: {} }])) === 'PROVA_SEM_GABARITO', 'Prova sem gabarito → salvar o gabarito antes');

    check(codigo(await lancar(prova.id, [{ aluno_id: a1.id, respostas: {} }], tB)) === 'PROVA_NAO_ENCONTRADA', 'Professor B não lança na prova do A');
    check(codigo(await lancar(prova.id, [{ aluno_id: a1.id, respostas: {} }], tCoord)) === 'SEM_PERMISSAO', 'Gestão não lança');
    const pelaAdmin = await lancar(naEletiva.id, [{ aluno_id: b1.id, respostas: { 1: 'A', 2: 'B' } }], tAdmin);
    check(pelaAdmin.status === 200 && pelaAdmin.json[0].user_id === profA.id && pelaAdmin.json[0].nota === 5, 'Admin lança; fica no nome do professor dono');
    check((await call('PUT', `/provas/${prova.id}/resultados`, { body: { resultados: [] } })).status === 401, 'Sem login não lança');

    console.log('\n— Ver resultados —');
    const lista = await resultados(prova.id);
    check(lista.length === 3 && lista.map((r) => r.alunos.numero_chamada).join(',') === '1,2,3', 'Lista as folhas da prova, em ordem de chamada');
    check((await resultados(prova.id, tCoord)).length === 3, 'Gestão vê');
    check(codigo(await call('GET', `/provas/${prova.id}/resultados`, { token: tB })) === 'PROVA_NAO_ENCONTRADA', 'Professor B não vê');

    console.log('\n— Recalcular quando a prova muda —');
    await gab(prova.id, 'ABCD', [4]);
    check((await doAluno(a2.id)).nota === 10 && (await doAluno(a2.id)).acertos === 4, 'Anular uma questão recalcula: ela vira acerto para todos');
    check((await doAluno(a3.id)).nota === 6, 'A nota ajustada à mão não muda');
    await call('PATCH', `/provas/${prova.id}`, { token: tA, body: { valor_total: 5 } });
    check((await doAluno(a1.id)).nota === 5 && (await doAluno(a3.id)).nota === 6, 'Mudar o valor da prova recalcula as automáticas');
    await gab(prova.id, 'ABCA');
    check((await doAluno(a2.id)).acertos === 3 && (await doAluno(a2.id)).nota === 3.75, 'Corrigir o gabarito recalcula (3 de 4 em 5 pontos = 3,75)');
    const volta = await lancar(prova.id, [{ aluno_id: a3.id, respostas: { 1: 'A' }, nota: null }]);
    check(volta.json?.[0]?.ajuste_manual === false && volta.json[0].nota === 1.25, 'Nota vazia (null) volta ao cálculo automático');

    console.log('\n— Apagar uma folha —');
    check(codigo(await call('DELETE', `/provas/${prova.id}/resultados/${a1.id}`, { token: tB })) === 'PROVA_NAO_ENCONTRADA', 'Professor B não apaga');
    check(codigo(await call('DELETE', `/provas/${prova.id}/resultados/${a1.id}`, { token: tCoord })) === 'SEM_PERMISSAO', 'Gestão não apaga');
    check((await call('DELETE', `/provas/${prova.id}/resultados/${a1.id}`, { token: tA })).status === 204, 'Dono apaga a folha de um aluno');
    check((await resultados(prova.id)).length === 2, 'As outras folhas ficam');
    check(codigo(await call('DELETE', `/provas/${prova.id}/resultados/${a1.id}`, { token: tA })) === 'RESULTADO_NAO_ENCONTRADO', 'Apagar de novo → não encontrada');
  } finally {
    server.close();
    // Apagar as turmas leva alunos e resultados; os usuários levam provas e gabaritos.
    const turmas = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    console.log(`\n🧹 ${turmas.count} turmas e ${count} usuários de teste (com provas e correções) apagados.`);
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
