/**
 * Conferência da Fase 2, Parte 3: matérias (disciplinas) e os vínculos matéria ↔ turma
 * (turma_disciplinas), com o padrão A de autorização (dono altera, gestão só lê, admin
 * pode tudo). Cria usuários de teste temporários (e-mails `teste-disciplinas-*`), sobe a
 * API numa porta livre, testa via HTTP e apaga tudo ao final. Não toca no admin real.
 *
 * Uso: npm run test:disciplinas
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

const PREFIXO = `teste-disciplinas-${Date.now()}`;
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

type Disciplina = { id: string; nome: string; user_id: string };
type Vinculo = { turma_id: string; disciplina_id: string; user_id: string; turmas: { nome: string }; disciplinas: { nome: string } };

async function main() {
  const server = app.listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  const ids: string[] = [];

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
    const criar = (body: unknown, t = tA) => call('POST', '/disciplinas', { token: t, body });
    const ver = (id: string, t = tA) => call('GET', `/disciplinas/${id}`, { token: t });
    const editar = (id: string, body: unknown, t = tA) => call('PATCH', `/disciplinas/${id}`, { token: t, body });
    const excluir = (id: string, t = tA) => call('DELETE', `/disciplinas/${id}`, { token: t });
    const vincular = (id: string, turma_ids: unknown, t = tA) => call('PUT', `/disciplinas/${id}/turmas`, { token: t, body: { turma_ids } });
    const vinculos = async (query: string, t = tA) => (await call('GET', `/turma-disciplinas?${query}`, { token: t })).json as Vinculo[];
    const listar = async (t: string) =>
      ((await call('GET', '/disciplinas', { token: t })).json as Disciplina[]).filter((d) => d.nome.startsWith(PREFIXO));
    const novaTurma = async (nome: string, t: string) =>
      (await call('POST', '/turmas', { token: t, body: { nome: `${PREFIXO} ${nome}`, serie: '7º Ano' } })).json as { id: string };

    const tA1 = await novaTurma('7A', tA);
    const tA2 = await novaTurma('7B', tA);
    const tB1 = await novaTurma('9C', tB);

    console.log('\n— Criar —');
    const mat = await criar({ nome: `${PREFIXO} Matemática`, cor: 'verde' });
    check(mat.status === 201 && mat.json.user_id === profA.id && mat.json.cor === 'verde', 'Professor cria matéria com cor e fica como dono');
    const port = await criar({ nome: `${PREFIXO} Português`, professor: 'Prof. A', carga_horaria: 80, user_id: profB.id });
    check(port.status === 201 && port.json.cor === 'azul' && port.json.carga_horaria === 80, 'Sem cor, fica azul; aceita professor e carga horária');
    check(port.json?.user_id === profA.id, 'Mandar outro "user_id" no corpo é ignorado (dono é quem cria)');
    const histB = await criar({ nome: `${PREFIXO} História`, cor: 'rosa' }, tB);
    const geoC = await criar({ nome: `${PREFIXO} Geografia` }, tCoord);
    check(histB.status === 201 && geoC.status === 201, 'Outro professor e a gestão também criam as próprias');
    check(codigo(await criar({ cor: 'azul' })) === 'DADOS_INVALIDOS', 'Sem nome → erro de dados');
    check(codigo(await criar({ nome: '  ' })) === 'DADOS_INVALIDOS', 'Nome só com espaços → erro de dados');
    check(codigo(await criar({ nome: 'X', cor: 'magenta' })) === 'DADOS_INVALIDOS', 'Cor fora da paleta → erro de dados');
    check(codigo(await criar({ nome: 'X', cor: null })) === 'DADOS_INVALIDOS', 'Cor vazia → erro de dados');
    check(codigo(await criar({ nome: 'X', carga_horaria: -1 })) === 'DADOS_INVALIDOS', 'Carga horária negativa → erro de dados');
    check(codigo(await criar({ nome: 'X', professor: 5 })) === 'DADOS_INVALIDOS', 'Professor que não é texto → erro de dados');
    check((await call('POST', '/disciplinas', { body: { nome: 'X' } })).status === 401, 'Sem login não cria');
    check((await prisma.disciplinas.count({ where: { nome: 'X', user_id: { in: ids } } })) === 0, 'Nenhuma matéria inválida foi gravada');

    console.log('\n— Listar e ver —');
    const listaA = await listar(tA);
    check(
      JSON.stringify(listaA.map((d) => d.nome)) === JSON.stringify([`${PREFIXO} Matemática`, `${PREFIXO} Português`]),
      'Professor vê só as próprias matérias, em ordem de nome',
    );
    check(JSON.stringify((await listar(tB)).map((d) => d.nome)) === JSON.stringify([`${PREFIXO} História`]), 'O outro professor também só vê as dele');
    check((await listar(tCoord)).length === 4 && (await listar(tAdmin)).length === 4, 'Gestão e admin veem as matérias de todos');
    check((await call('GET', '/disciplinas')).status === 401, 'Sem login não lista');
    check((await ver(mat.json.id)).json?.nome === `${PREFIXO} Matemática`, 'Dono vê a matéria pelo id');
    check(codigo(await ver(mat.json.id, tB)) === 'DISCIPLINA_NAO_ENCONTRADA', 'Professor B não vê matéria do A (como se não existisse)');
    check((await ver(mat.json.id, tCoord)).status === 200, 'Gestão vê a matéria de qualquer professor');
    check(codigo(await ver(INEXISTENTE)) === 'DISCIPLINA_NAO_ENCONTRADA', 'Matéria inexistente → não encontrada');
    check(codigo(await ver('xyz')) === 'DISCIPLINA_NAO_ENCONTRADA', 'Id malformado → não encontrada (sem erro interno)');

    console.log('\n— Editar —');
    const e1 = await editar(mat.json.id, { cor: 'roxo' });
    check(e1.status === 200 && e1.json.cor === 'roxo' && e1.json.nome === `${PREFIXO} Matemática`, 'Dono altera só o campo enviado');
    check((await editar(port.json.id, { cor: '__inativa' })).json?.cor === '__inativa', 'Dono inativa a matéria (marca especial da tela)');
    check((await editar(mat.json.id, { nome: `${PREFIXO} Matemática`, user_id: profB.id })).json?.user_id === profA.id, 'Não dá para passar a matéria para outro dono');
    check(codigo(await editar(mat.json.id, {})) === 'DADOS_INVALIDOS', 'Nada para alterar → erro de dados');
    check(codigo(await editar(mat.json.id, { nome: '' })) === 'DADOS_INVALIDOS', 'Apagar o nome → erro de dados');
    check(codigo(await editar(mat.json.id, { cor: 'azul' }, tB)) === 'DISCIPLINA_NAO_ENCONTRADA', 'Professor B não altera matéria do A');
    check(codigo(await editar(mat.json.id, { cor: 'azul' }, tCoord)) === 'SEM_PERMISSAO', 'Gestão vê, mas não altera matéria de professor');
    check((await prisma.disciplinas.findUnique({ where: { id: mat.json.id } }))?.cor === 'roxo', 'As tentativas barradas não mudaram nada');
    check((await editar(mat.json.id, { carga_horaria: 120 }, tAdmin)).json?.carga_horaria === 120, 'Admin altera matéria de qualquer professor');
    check(codigo(await editar(INEXISTENTE, { cor: 'azul' })) === 'DISCIPLINA_NAO_ENCONTRADA', 'Matéria inexistente → não encontrada');

    console.log('\n— Vínculos com turmas —');
    const v1 = await vincular(mat.json.id, [tA1.id, tA2.id]);
    check(v1.status === 200 && v1.json.length === 2 && v1.json.every((v: Vinculo) => v.user_id === profA.id), 'Dono escolhe as turmas da matéria');
    check(v1.json?.[0]?.turmas?.nome === `${PREFIXO} 7A` && v1.json?.[0]?.disciplinas?.nome === `${PREFIXO} Matemática`, 'Cada vínculo traz a turma e a matéria');
    check((await vincular(mat.json.id, [tA1.id, tA2.id, tA1.id])).json?.length === 2, 'Repetir a mesma lista (ou turmas repetidas) não duplica');
    const so7b = await vincular(mat.json.id, [tA2.id]);
    check(so7b.json?.length === 1 && so7b.json[0].turma_id === tA2.id, 'Nova lista substitui a anterior (tira a turma desmarcada)');
    await vincular(port.json.id, [tA1.id]);
    check((await vinculos('')).filter((v) => v.disciplinas.nome.startsWith(PREFIXO)).length === 2, 'Professor lista os próprios vínculos');
    check((await vinculos(`turma_id=${tA1.id}`)).length === 1 && (await vinculos(`disciplina_id=${mat.json.id}`)).length === 1, 'Filtros por turma e por matéria');

    check(codigo(await vincular(mat.json.id, [tB1.id])) === 'TURMA_INVALIDA', 'Professor não vincula a turma de outro professor');
    check(codigo(await vincular(mat.json.id, [INEXISTENTE])) === 'TURMA_INVALIDA', 'Turma inexistente → turma inválida');
    check(codigo(await vincular(mat.json.id, ['abc'])) === 'TURMA_INVALIDA', 'Turma malformada → turma inválida (sem erro interno)');
    check(codigo(await vincular(mat.json.id, 'x')) === 'DADOS_INVALIDOS', 'Sem lista de turmas → erro de dados');
    check(codigo(await vincular(mat.json.id, [1, 2])) === 'DADOS_INVALIDOS', 'Lista com itens que não são texto → erro de dados');
    check((await prisma.turma_disciplinas.count({ where: { disciplina_id: mat.json.id } })) === 1, 'As tentativas inválidas não mudaram os vínculos');

    check((await vinculos(`disciplina_id=${mat.json.id}`, tB)).length === 0, 'Professor B não vê os vínculos do A');
    check(codigo(await vincular(mat.json.id, [], tB)) === 'DISCIPLINA_NAO_ENCONTRADA', 'Professor B não mexe nos vínculos do A');
    check((await vinculos(`user_id=${profA.id}`, tCoord)).length === 2, 'Gestão vê os vínculos de um professor');
    check(codigo(await vincular(mat.json.id, [], tCoord)) === 'SEM_PERMISSAO', 'Gestão não altera os vínculos de professor');
    check(codigo(await call('GET', '/turma-disciplinas?turma_id=abc', { token: tA })) === 'DADOS_INVALIDOS', 'Filtro malformado → erro de dados');
    const vAdmin = await vincular(mat.json.id, [tA1.id, tB1.id], tAdmin);
    check(vAdmin.status === 200 && vAdmin.json.length === 2 && vAdmin.json.every((v: Vinculo) => v.user_id === profA.id), 'Admin altera; os vínculos ficam no nome do dono da matéria');
    check((await vinculos(`disciplina_id=${mat.json.id}`)).length === 2, 'O dono enxerga os vínculos feitos pelo admin');
    check((await vincular(mat.json.id, [])).json?.length === 0, 'Lista vazia tira a matéria de todas as turmas');
    check((await call('DELETE', `/turmas/${tA1.id}`, { token: tA })).status === 204, 'Excluir a turma...');
    check((await prisma.turma_disciplinas.count({ where: { turma_id: tA1.id } })) === 0, '...leva junto os vínculos dela');

    console.log('\n— Excluir —');
    await vincular(mat.json.id, [tA2.id]);
    check(codigo(await excluir(mat.json.id, tB)) === 'DISCIPLINA_NAO_ENCONTRADA', 'Professor B não exclui matéria do A');
    check(codigo(await excluir(mat.json.id, tCoord)) === 'SEM_PERMISSAO', 'Gestão não exclui matéria de professor');
    check((await excluir(mat.json.id)).status === 204, 'Dono exclui a matéria');
    check(codigo(await ver(mat.json.id)) === 'DISCIPLINA_NAO_ENCONTRADA', 'Depois de excluída, não aparece mais');
    check((await prisma.turma_disciplinas.count({ where: { disciplina_id: mat.json.id } })) === 0, 'Os vínculos dela saem junto');
    check((await prisma.turmas.count({ where: { id: tA2.id } })) === 1, 'A turma continua existindo');
    check((await excluir(histB.json.id, tAdmin)).status === 204, 'Admin exclui matéria de qualquer professor');
    check(codigo(await excluir(INEXISTENTE)) === 'DISCIPLINA_NAO_ENCONTRADA', 'Matéria inexistente → não encontrada');
  } finally {
    server.close();
    // Matérias e vínculos saem em cascata com o usuário; turmas não (user_id vira nulo).
    const turmas = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    console.log(`\n🧹 ${turmas.count} turmas e ${count} usuários de teste apagados (com matérias e vínculos).`);
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
