/**
 * Conferência da Fase 4, Parte 2: médias arredondadas (a nota final que o professor ajusta à mão),
 * com o padrão A (dono ajusta, gestão só vê, admin pode tudo). Cria usuários de teste temporários
 * (e-mails `teste-medias-*`), turmas, alunos e matérias, testa via HTTP e apaga tudo ao final.
 *
 * Uso: npm run test:medias
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

const PREFIXO = `teste-medias-${Date.now()}`;
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

type Media = { aluno_id: string; turma_id: string; disciplina_id: string; bimestre: number; nota_arredondada: number; manual: boolean; user_id: string };

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

    const planilha = { turma_id: turma.id, disciplina_id: mat.id, bimestre: 1 };
    const salvar = (medias: unknown, t = tA, extra: object = {}) =>
      call('PUT', '/medias-arredondadas', { token: t, body: { ...planilha, ...extra, medias } });
    const descartar = (body: object, t = tA) => call('POST', '/medias-arredondadas/descartar', { token: t, body: { ...planilha, ...body } });
    const medias = async (query: string, t = tA) => (await call('GET', `/medias-arredondadas?${query}`, { token: t })).json as Media[];
    const daPlanilha = `turma_id=${turma.id}&disciplina_id=${mat.id}&bimestre=1`;

    console.log('\n— Ajustar médias —');
    const s1 = await salvar([
      { aluno_id: a1.id, nota_arredondada: 7 },
      { aluno_id: a2.id, nota_arredondada: 5.5, manual: true },
      { aluno_id: a3.id, nota_arredondada: 6 },
    ]);
    check(s1.status === 200 && s1.json.salvas.length === 3 && s1.json.apagadas === 0, 'Professor ajusta a média de vários alunos de uma vez');
    const m1 = s1.json.salvas[0] as Media;
    check(m1.nota_arredondada === 7 && typeof m1.nota_arredondada === 'number', 'A média sai como número (como o Supabase), não como texto');
    check(m1.manual === true && m1.user_id === profA.id && m1.turma_id === turma.id && m1.bimestre === 1, 'Fica marcada como manual, no nome do professor, na turma e bimestre certos');
    await salvar([{ aluno_id: a1.id, nota_arredondada: 7.5 }]);
    const doA1 = await prisma.medias_arredondadas.findMany({ where: { aluno_id: a1.id } });
    check(doA1.length === 1 && doA1[0].nota_arredondada.toNumber() === 7.5, 'Corrigir atualiza o mesmo ajuste (não duplica)');
    const volta = await salvar([{ aluno_id: a3.id, nota_arredondada: null }]);
    check(volta.json?.apagadas === 1 && (await prisma.medias_arredondadas.count({ where: { aluno_id: a3.id } })) === 0, 'Média vazia (null) volta ao cálculo automático');
    const outroBim = await salvar([{ aluno_id: a1.id, nota_arredondada: 9 }], tA, { bimestre: 2 });
    check(outroBim.status === 200 && (await prisma.medias_arredondadas.count({ where: { aluno_id: a1.id } })) === 2, 'Cada bimestre tem o seu ajuste');

    check(codigo(await salvar([{ aluno_id: a1.id, nota_arredondada: 10.5 }])) === 'DADOS_INVALIDOS', 'Média acima de 10 → erro de dados');
    check(codigo(await salvar([{ aluno_id: a1.id, nota_arredondada: -1 }])) === 'DADOS_INVALIDOS', 'Média negativa → erro de dados');
    check(codigo(await salvar([{ aluno_id: a1.id, nota_arredondada: '7' }])) === 'DADOS_INVALIDOS', 'Média em texto → erro de dados');
    check(codigo(await salvar([{ aluno_id: a1.id, nota_arredondada: 7, manual: 'sim' }])) === 'DADOS_INVALIDOS', '"manual" que não é sim/não → erro de dados');
    check(codigo(await salvar([])) === 'DADOS_INVALIDOS', 'Lista vazia → erro de dados');
    check(
      codigo(await salvar([{ aluno_id: a2.id, nota_arredondada: 5 }, { aluno_id: a2.id, nota_arredondada: 6 }])) === 'DADOS_INVALIDOS',
      'O mesmo aluno duas vezes → erro de dados',
    );
    check(codigo(await salvar([{ aluno_id: a1.id, nota_arredondada: 7 }], tA, { bimestre: 5 })) === 'DADOS_INVALIDOS', 'Bimestre 5 → erro de dados');
    check(codigo(await salvar([{ aluno_id: a1.id, nota_arredondada: 7 }], tA, { turma_id: undefined })) === 'DADOS_INVALIDOS', 'Sem turma → erro de dados');
    check(codigo(await salvar([{ aluno_id: a1.id, nota_arredondada: 7 }], tA, { turma_id: turmaB.id })) === 'TURMA_INVALIDA', 'Turma de outro professor → turma inválida');
    check(codigo(await salvar([{ aluno_id: a1.id, nota_arredondada: 7 }], tA, { disciplina_id: matB.id })) === 'DISCIPLINA_INVALIDA', 'Matéria de outro professor → matéria inválida');
    check(codigo(await salvar([{ aluno_id: INEXISTENTE, nota_arredondada: 7 }])) === 'ALUNO_INVALIDO', 'Aluno inexistente → aluno inválido');
    check(codigo(await salvar([{ aluno_id: b1.id, nota_arredondada: 7 }])) === 'ALUNO_FORA_DA_TURMA', 'Aluno de outra turma → fora da turma');
    const misto = await salvar([{ aluno_id: a3.id, nota_arredondada: 8 }, { aluno_id: b1.id, nota_arredondada: 7 }]);
    check(codigo(misto) === 'ALUNO_FORA_DA_TURMA' && (await prisma.medias_arredondadas.count({ where: { aluno_id: a3.id } })) === 0, 'Um aluno errado no lote → nenhum ajuste entra');
    const naEletiva = await salvar([{ aluno_id: b1.id, nota_arredondada: 8 }], tA, { turma_id: eletiva.id });
    check(naEletiva.status === 200, 'Na eletiva, o membro (de outra turma) tem a média ajustada');

    check(codigo(await salvar([{ aluno_id: a1.id, nota_arredondada: 7 }], tB)) === 'TURMA_INVALIDA', 'Professor B não ajusta na planilha do A');
    check(codigo(await salvar([{ aluno_id: a1.id, nota_arredondada: 7 }], tCoord)) === 'SEM_PERMISSAO', 'Gestão não ajusta');
    const pelaAdmin = await salvar([{ aluno_id: a3.id, nota_arredondada: 6.5 }], tAdmin);
    check(pelaAdmin.status === 200 && pelaAdmin.json.salvas[0].user_id === profA.id, 'Admin ajusta; o ajuste fica no nome do professor dono da matéria');
    check((await call('PUT', '/medias-arredondadas', { body: { ...planilha, medias: [] } })).status === 401, 'Sem login não ajusta');

    console.log('\n— Ver médias —');
    const lista = await medias(daPlanilha);
    check(lista.length === 3 && lista.every((m) => typeof m.nota_arredondada === 'number'), 'Médias da planilha (turma, matéria e bimestre)');
    check((await medias(`${daPlanilha}&aluno_id=${a1.id},${a2.id}`)).length === 2, 'Só dos alunos pedidos (o que a planilha pede)');
    check((await medias(`aluno_id=${a1.id}`)).length === 2, 'De um aluno, em todos os bimestres');
    check((await medias(daPlanilha, tB)).length === 0, 'Professor B não vê as médias do A');
    check((await medias(daPlanilha, tCoord)).length === 3, 'Gestão vê');
    check(codigo(await call('GET', '/medias-arredondadas?bimestre=9', { token: tA })) === 'DADOS_INVALIDOS', 'Bimestre inválido no filtro → erro de dados');
    check(codigo(await call('GET', '/medias-arredondadas?aluno_id=abc', { token: tA })) === 'DADOS_INVALIDOS', 'Filtro malformado → erro de dados');
    check((await call('GET', '/medias-arredondadas')).status === 401, 'Sem login não vê');

    console.log('\n— Descartar ajustes —');
    check(codigo(await descartar({}, tB)) === 'TURMA_INVALIDA', 'Professor B não descarta os do A');
    check(codigo(await descartar({}, tCoord)) === 'SEM_PERMISSAO', 'Gestão não descarta');
    check(codigo(await descartar({ aluno_ids: ['abc'] })) === 'DADOS_INVALIDOS', 'Lista de alunos malformada → erro de dados');
    const um = await descartar({ aluno_ids: [a2.id] });
    check(um.status === 200 && um.json.apagadas === 1 && (await medias(daPlanilha)).length === 2, 'Descarta só o ajuste de um aluno');
    const todos = await descartar({});
    check(todos.json?.apagadas === 2 && (await medias(daPlanilha)).length === 0, '"Descartar todas": a planilha inteira volta ao cálculo automático');
    check(
      (await prisma.medias_arredondadas.count({ where: { aluno_id: a1.id, bimestre: 2 } })) === 1 &&
        (await prisma.medias_arredondadas.count({ where: { turma_id: eletiva.id } })) === 1,
      'Os ajustes de outros bimestres e turmas ficam',
    );
    check((await descartar({})).json?.apagadas === 0, 'Descartar de novo não dá erro (nada a fazer)');
  } finally {
    server.close();
    // Apagar as turmas leva alunos e médias; matérias saem com os usuários.
    const turmas = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    console.log(`\n🧹 ${turmas.count} turmas (com alunos e médias) e ${count} usuários de teste apagados.`);
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
