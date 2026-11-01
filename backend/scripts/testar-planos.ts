/**
 * Conferência da Fase 4, Parte 6: planos de aula (as aulas da planilha do planejamento ou soltas),
 * duplicar, "copiar para baixo", ajustes (PDCA) e a trava da planilha validada, com o padrão A.
 * Cria usuários de teste temporários (e-mails `teste-planos-*`), turmas, matérias e planejamentos,
 * testa via HTTP e apaga tudo ao final.
 *
 * Uso: npm run test:planos
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

const PREFIXO = `teste-planos-${Date.now()}`;
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

type Plano = {
  id: string; user_id: string; turma_id: string | null; disciplina_id: string | null; bimestre: number; data_aula: string;
  dia_semana: string | null; numero_aulas: number | null; conteudo: string | null; recursos: string | null; status: string;
  planejamento_id: string | null; duplicado_de: string | null; turmas: { nome: string } | null; disciplinas: { nome: string } | null;
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
    const turma = await post('/turmas', { nome: `${PREFIXO} 7C`, serie: '7º Ano' });
    const turmaB = await post('/turmas', { nome: `${PREFIXO} 7D`, serie: '7º Ano' }, tB);
    const mat = await post('/disciplinas', { nome: `${PREFIXO} Português` });
    const plan = await post('/planejamentos', { turma_id: turma.id, disciplina_id: mat.id, bimestre: 2 });
    const planB = await post('/planejamentos', { turma_id: turmaB.id, bimestre: 1 }, tB);

    const criar = (body: object, t = tA) => call('POST', '/planos-aula', { token: t, body });
    const editar = (id: string, body: unknown, t = tA) => call('PATCH', `/planos-aula/${id}`, { token: t, body });
    const aulas = (planejamento: string, body: object, t = tA) => call('POST', `/planejamentos/${planejamento}/aulas`, { token: t, body });
    const lista = async (query: string, t = tA) => (await call('GET', `/planos-aula?${query}`, { token: t })).json as Plano[];

    console.log('\n— Aulas no planejamento —');
    const l1 = await criar({ planejamento_id: plan.id, data_aula: '2026-05-04' });
    const r1 = l1.json as Plano;
    check(l1.status === 201 && r1.planejamento_id === plan.id && r1.turma_id === turma.id && r1.disciplina_id === mat.id && r1.bimestre === 2, 'Adiciona uma aula: turma, matéria e bimestre vêm do planejamento');
    check(r1.data_aula === '2026-05-04' && r1.dia_semana === 'Segunda-feira' && r1.status === 'pendente' && r1.numero_aulas === 1, 'Data AAAA-MM-DD, dia da semana calculado, pendente, 1 aula');
    check(r1.turmas?.nome === `${PREFIXO} 7C` && r1.disciplinas?.nome === `${PREFIXO} Português` && r1.user_id === profA.id, 'Vem com o nome da turma e da matéria, no nome do professor');
    const seq = await aulas(plan.id, { datas: ['2026-05-08', '2026-05-06', '2026-05-11'] });
    check(seq.status === 201 && seq.json.length === 3 && seq.json.map((p: Plano) => p.data_aula).join(',') === '2026-05-06,2026-05-08,2026-05-11', '"Datas em sequência": várias aulas de uma vez, em ordem de data');
    check(seq.json.every((p: Plano) => p.planejamento_id === plan.id && p.dia_semana !== null), 'Todas no planejamento, com o dia da semana');
    check(codigo(await aulas(plan.id, { datas: ['2026-02-30'] })) === 'DADOS_INVALIDOS', 'Data impossível na sequência → erro de dados');
    check(codigo(await aulas(plan.id, { datas: [] })) === 'DADOS_INVALIDOS', 'Sequência vazia → erro de dados');
    check(codigo(await aulas(planB.id, { datas: ['2026-05-04'] })) === 'PLANEJAMENTO_NAO_ENCONTRADO', 'Não adiciona no planejamento de outro professor');
    check(codigo(await aulas(plan.id, { datas: ['2026-05-04'] }, tCoord)) === 'SEM_PERMISSAO', 'Gestão não adiciona aulas');
    check(codigo(await criar({ planejamento_id: plan.id })) === 'DADOS_INVALIDOS', 'Sem data → erro de dados');
    check(codigo(await criar({ planejamento_id: INEXISTENTE, data_aula: '2026-05-04' })) === 'PLANEJAMENTO_NAO_ENCONTRADO', 'Planejamento inexistente → não encontrado');

    console.log('\n— Aula solta —');
    const solta = await criar({ data_aula: '2026-06-01', turma_id: turma.id, bimestre: 3, conteudo: 'Revisão', numero_aulas: 2 });
    check(solta.status === 201 && solta.json.planejamento_id === null && solta.json.bimestre === 3 && solta.json.numero_aulas === 2 && solta.json.conteudo === 'Revisão', 'Cria uma aula fora de planejamento, com os textos');
    check(codigo(await criar({ data_aula: '2026-06-01', turma_id: turmaB.id })) === 'TURMA_INVALIDA', 'Turma de outro professor → turma inválida');
    check(codigo(await criar({ data_aula: '2026-06-01', numero_aulas: 50 })) === 'DADOS_INVALIDOS', 'Número de aulas fora do intervalo → erro de dados');

    console.log('\n— Editar —');
    const e1 = await editar(r1.id, { conteudo: 'Substantivos', recursos: 'Livro', data_aula: '2026-05-05' });
    check(e1.status === 200 && e1.json.conteudo === 'Substantivos' && e1.json.recursos === 'Livro' && e1.json.dia_semana === 'Terça-feira', 'Dono edita os textos; mudar a data muda o dia da semana');
    check((await editar(r1.id, { conteudo: '' })).json?.conteudo === null, 'Apagar uma célula deixa vazia');
    check(codigo(await editar(r1.id, { turma_id: turma.id })) === 'DADOS_INVALIDOS', 'Aula do planejamento não muda de turma');
    check((await editar(solta.json.id, { bimestre: 4 })).json?.bimestre === 4, 'Aula solta muda de bimestre');
    check(codigo(await editar(r1.id, { data_aula: null })) === 'DADOS_INVALIDOS', 'Data vazia → erro de dados');
    check(codigo(await editar(r1.id, {})) === 'DADOS_INVALIDOS', 'Nada para alterar → erro de dados');
    check(codigo(await editar(r1.id, { status: 'aprovado' })) === 'DADOS_INVALIDOS', 'A situação de aprovação não muda por aqui');
    check(codigo(await editar(r1.id, { conteudo: 'X' }, tB)) === 'PLANO_NAO_ENCONTRADO', 'Professor B não edita');
    check(codigo(await editar(r1.id, { conteudo: 'X' }, tCoord)) === 'SEM_PERMISSAO', 'Gestão vê, mas não edita');
    check((await editar(r1.id, { recursos: 'Pelo admin' }, tAdmin)).json?.recursos === 'Pelo admin', 'Admin edita');

    const ids3 = seq.json.map((p: Plano) => p.id);
    const lote = await call('PATCH', '/planos-aula/lote', { token: tA, body: { ids: ids3, dados: { recursos: 'Projetor' } } });
    check(lote.status === 200 && lote.json.alteradas === 3, '"Copiar para baixo": o mesmo valor em várias aulas');
    check((await prisma.planos_aula.count({ where: { id: { in: ids3 }, recursos: 'Projetor' } })) === 3, 'As três ficaram com o valor');
    check(codigo(await call('PATCH', '/planos-aula/lote', { token: tA, body: { ids: [...ids3, planB.id], dados: { recursos: 'X' } } })) === 'PLANO_NAO_ENCONTRADO', 'Com uma aula que não existe, nenhuma muda');
    check(codigo(await call('PATCH', '/planos-aula/lote', { token: tCoord, body: { ids: ids3, dados: { recursos: 'X' } } })) === 'SEM_PERMISSAO', 'Gestão não copia');

    console.log('\n— Ver —');
    check((await lista(`planejamento_id=${plan.id}`)).map((p) => p.data_aula).join(',') === '2026-05-05,2026-05-06,2026-05-08,2026-05-11', 'Aulas do planejamento, em ordem de data');
    check((await lista(`turma_id=${turma.id}&data=2026-06-01`)).length === 1, 'Aula de um dia (o que a Agenda pede)');
    check((await lista('de=2026-05-06&ate=2026-05-08')).length === 2, 'Aulas de um período');
    check((await lista('de=2026-05-01&limite=2')).length === 2, 'Com limite (próximas aulas do painel)');
    check((await lista('')).length === 5 && (await lista('', tB)).length === 0, 'Professor vê só as próprias');
    check((await lista(`user_id=${profA.id}`, tCoord)).length === 5, 'Gestão vê, e filtra por professor');
    check((await call('GET', `/planos-aula/${r1.id}`, { token: tCoord })).json?.id === r1.id, 'Gestão abre uma aula');
    check(codigo(await call('GET', `/planos-aula/${r1.id}`, { token: tB })) === 'PLANO_NAO_ENCONTRADO', 'Professor B não abre');
    check(codigo(await call('GET', '/planos-aula?de=31-12-2026', { token: tA })) === 'DADOS_INVALIDOS', 'Data malformada no filtro → erro de dados');

    console.log('\n— Duplicar —');
    const dup = await call('POST', `/planos-aula/${r1.id}/duplicar`, { token: tA, body: {} });
    check(dup.status === 201 && dup.json.data_aula === '2026-05-12' && dup.json.duplicado_de === r1.id && dup.json.recursos === 'Pelo admin', 'Duplica para uma semana depois, com os textos e de onde veio');
    check(dup.json?.planejamento_id === plan.id && dup.json.status === 'pendente' && dup.json.user_id === profA.id, 'A cópia fica no mesmo planejamento, pendente, do mesmo dono');
    const dup2 = await call('POST', `/planos-aula/${r1.id}/duplicar`, { token: tAdmin, body: { data_aula: '2026-05-19' } });
    check(dup2.json?.data_aula === '2026-05-19' && dup2.json.user_id === profA.id, 'Duplica para a data escolhida; pelo admin, continua do professor');
    check(codigo(await call('POST', `/planos-aula/${r1.id}/duplicar`, { token: tCoord, body: {} })) === 'SEM_PERMISSAO', 'Gestão não duplica');

    console.log('\n— Ajustes (PDCA) —');
    const aj = await call('POST', `/planos-aula/${r1.id}/ajustes`, { token: tA, body: { descricao: 'Turma precisou de mais exemplos' } });
    check(aj.status === 201 && aj.json.descricao === 'Turma precisou de mais exemplos', 'Dono registra um ajuste');
    await call('POST', `/planos-aula/${r1.id}/ajustes`, { token: tA, body: { descricao: 'Segundo ajuste' } });
    const hist = (await call('GET', `/planos-aula/${r1.id}/ajustes`, { token: tCoord })).json;
    check(hist.length === 2 && hist[0].descricao === 'Segundo ajuste', 'Histórico de ajustes, o mais novo primeiro (gestão vê)');
    check(codigo(await call('POST', `/planos-aula/${r1.id}/ajustes`, { token: tA, body: { descricao: '  ' } })) === 'DADOS_INVALIDOS', 'Ajuste vazio → erro de dados');
    check(codigo(await call('POST', `/planos-aula/${r1.id}/ajustes`, { token: tCoord, body: { descricao: 'X' } })) === 'SEM_PERMISSAO', 'Gestão não registra ajuste');
    check(codigo(await call('GET', `/planos-aula/${r1.id}/ajustes`, { token: tB })) === 'PLANO_NAO_ENCONTRADO', 'Professor B não vê os ajustes');

    console.log('\n— Planilha validada fica travada —');
    await call('POST', `/planejamentos/${plan.id}/status`, { token: tCoord, body: { status: 'validado' } });
    check(codigo(await editar(r1.id, { conteudo: 'X' })) === 'PLANEJAMENTO_VALIDADO', 'Não edita aula de planejamento validado');
    check(codigo(await editar(r1.id, { conteudo: 'X' }, tAdmin)) === 'PLANEJAMENTO_VALIDADO', 'Nem o admin');
    check(codigo(await aulas(plan.id, { datas: ['2026-05-20'] })) === 'PLANEJAMENTO_VALIDADO', 'Não adiciona aulas');
    check(codigo(await call('PATCH', '/planos-aula/lote', { token: tA, body: { ids: ids3, dados: { recursos: 'X' } } })) === 'PLANEJAMENTO_VALIDADO', 'Não copia para baixo');
    check(codigo(await call('POST', `/planos-aula/${r1.id}/duplicar`, { token: tA, body: {} })) === 'PLANEJAMENTO_VALIDADO', 'Não duplica');
    check(codigo(await call('POST', `/planos-aula/${r1.id}/ajustes`, { token: tA, body: { descricao: 'X' } })) === 'PLANEJAMENTO_VALIDADO', 'Não registra ajuste');
    check(codigo(await call('DELETE', `/planos-aula/${r1.id}`, { token: tA })) === 'PLANEJAMENTO_VALIDADO', 'Não exclui');
    check((await editar(solta.json.id, { conteudo: 'Livre' })).status === 200, 'A aula solta continua editável');
    await call('POST', `/planejamentos/${plan.id}/status`, { token: tCoord, body: { status: 'rascunho' } });
    check((await editar(r1.id, { conteudo: 'Reaberto' })).json?.conteudo === 'Reaberto', 'Reaberto pela gestão, volta a editar');

    console.log('\n— Excluir —');
    check(codigo(await call('DELETE', `/planos-aula/${r1.id}`, { token: tB })) === 'PLANO_NAO_ENCONTRADO', 'Professor B não exclui');
    check(codigo(await call('DELETE', `/planos-aula/${r1.id}`, { token: tCoord })) === 'SEM_PERMISSAO', 'Gestão não exclui');
    check((await call('DELETE', `/planos-aula/${r1.id}`, { token: tA })).status === 204, 'Dono exclui uma aula que tem cópias');
    check(
      (await prisma.ajustes_plano.count({ where: { plano_id: r1.id } })) === 0 &&
        (await prisma.planos_aula.findUnique({ where: { id: dup.json.id } }))?.duplicado_de === null,
      'Os ajustes saem junto; as cópias ficam, sem a ligação',
    );
  } finally {
    server.close();
    // Apagar as turmas leva planejamentos, aulas e ajustes; matérias saem com os usuários.
    const turmas = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    await prisma.planos_aula.deleteMany({ where: { user_id: { in: ids } } });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    console.log(`\n🧹 ${turmas.count} turmas (com planejamentos e aulas) e ${count} usuários de teste apagados.`);
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
