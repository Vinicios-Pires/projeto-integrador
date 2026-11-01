/**
 * Conferência da Fase 2, Parte 4: membros das turmas personalizadas (eletivas), com o
 * padrão A herdado da turma (dono monta, gestão só vê, admin pode tudo). Cria usuários
 * de teste temporários (e-mails `teste-membros-*`), sobe a API numa porta livre, testa
 * via HTTP e apaga tudo ao final. Não toca no admin real.
 *
 * Uso: npm run test:membros
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

const PREFIXO = `teste-membros-${Date.now()}`;
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

type Membro = { aluno_id: string; user_id: string; alunos: { nome: string; turma_id: string; turmas: { nome: string } } };

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
    const novaTurma = async (nome: string, t: string, tipo = 'regular') =>
      (await call('POST', '/turmas', { token: t, body: { nome: `${PREFIXO} ${nome}`, serie: 'Ensino Médio', tipo } })).json as { id: string };
    const novoAluno = async (nome: string, turma_id: string) =>
      (await call('POST', '/alunos', { token: tA, body: { nome, turma_id } })).json as { id: string };
    const montar = (turma: string, aluno_ids: unknown, t = tA) => call('PUT', `/turmas/${turma}/membros`, { token: t, body: { aluno_ids } });
    const membros = (turma: string, t = tA, query = '') => call('GET', `/turmas/${turma}/membros${query}`, { token: t });
    const nomes = (lista: Membro[]) => lista.map((m) => m.alunos.nome).join(',');

    const regA = await novaTurma('1A', tA);
    const regB = await novaTurma('2B', tB);
    const eletiva = await novaTurma('Robótica', tA, 'personalizada');
    const eletivaB = await novaTurma('Teatro', tB, 'personalizada');
    const ana = await novoAluno('Ana', regA.id);
    const bia = await novoAluno('Bia', regA.id);
    const caio = await novoAluno('Caio', regA.id);
    const davi = await novoAluno('Davi', regB.id);
    const eva = await novoAluno('Eva', regB.id);

    console.log('\n— Montar a eletiva —');
    const m1 = await montar(eletiva.id, [davi.id, ana.id, bia.id]);
    check(m1.status === 200 && nomes(m1.json) === 'Ana,Bia,Davi', 'Dono escolhe alunos de várias turmas (lista em ordem de nome)');
    check(m1.json?.every((m: Membro) => m.user_id === profA.id), 'Os vínculos ficam no nome do dono da eletiva');
    check(m1.json?.find((m: Membro) => m.aluno_id === davi.id)?.alunos.turmas.nome === `${PREFIXO} 2B`, 'Cada membro traz a turma de origem do aluno');
    const vEletiva = (await call('GET', `/turmas/${eletiva.id}`, { token: tA })).json;
    check(vEletiva?.membros_count === 3 && vEletiva?.alunos_count === 0, 'A eletiva conta 3 membros e nenhum aluno próprio');
    check((await prisma.alunos.findUnique({ where: { id: davi.id } }))?.turma_id === regB.id, 'O aluno continua na turma de origem');
    check(nomes((await montar(eletiva.id, [ana.id, bia.id, davi.id, ana.id])).json) === 'Ana,Bia,Davi', 'Repetir a lista (ou alunos repetidos) não duplica');
    check(nomes((await montar(eletiva.id, [bia.id, eva.id])).json) === 'Bia,Eva', 'Nova lista substitui a anterior');
    check((await montar(eletiva.id, [])).json?.length === 0, 'Lista vazia esvazia a eletiva');
    await montar(eletiva.id, [ana.id, bia.id, caio.id, davi.id]);

    check(codigo(await montar(eletiva.id, 'x')) === 'DADOS_INVALIDOS', 'Sem lista de alunos → erro de dados');
    check(codigo(await montar(eletiva.id, [1])) === 'DADOS_INVALIDOS', 'Lista com itens que não são texto → erro de dados');
    check(codigo(await montar(eletiva.id, [INEXISTENTE])) === 'ALUNO_INVALIDO', 'Aluno inexistente → aluno inválido');
    check(codigo(await montar(eletiva.id, ['abc'])) === 'ALUNO_INVALIDO', 'Aluno malformado → aluno inválido (sem erro interno)');
    check(codigo(await montar(regA.id, [ana.id])) === 'TURMA_NAO_PERSONALIZADA', 'Turma regular não tem membros escolhidos');
    check((await prisma.turma_membros.count({ where: { turma_id: eletiva.id } })) === 4, 'As tentativas inválidas não mudaram os membros');

    check(codigo(await montar(eletiva.id, [], tB)) === 'TURMA_NAO_ENCONTRADA', 'Professor B não mexe na eletiva do A');
    check(codigo(await montar(eletivaB.id, [ana.id])) === 'TURMA_NAO_ENCONTRADA', '...nem o A na do B');
    check(codigo(await montar(eletiva.id, [], tCoord)) === 'SEM_PERMISSAO', 'Gestão não altera a eletiva de professor');
    const mAdmin = await montar(eletiva.id, [ana.id, bia.id, caio.id, eva.id], tAdmin);
    check(mAdmin.status === 200 && mAdmin.json.every((m: Membro) => m.user_id === profA.id), 'Admin altera; os vínculos continuam no nome do dono');
    check((await call('PUT', `/turmas/${eletiva.id}/membros`, { body: { aluno_ids: [] } })).status === 401, 'Sem login não altera');

    console.log('\n— Ver os membros —');
    await prisma.alunos.update({ where: { id: caio.id }, data: { ativo: false } });
    check(nomes((await membros(eletiva.id)).json) === 'Ana,Bia,Caio,Eva', 'Dono vê todos os membros');
    check(nomes((await membros(eletiva.id, tA, '?ativo=true')).json) === 'Ana,Bia,Eva', 'Filtro só de ativos (o que a tela de notas usa)');
    check(nomes((await membros(eletiva.id, tA, '?ativo=false')).json) === 'Caio', 'Filtro só de inativos');
    check(codigo(await membros(eletiva.id, tA, '?ativo=sim')) === 'DADOS_INVALIDOS', 'Filtro inválido → erro de dados');
    check(codigo(await membros(eletiva.id, tB)) === 'TURMA_NAO_ENCONTRADA', 'Professor B não vê os membros da eletiva do A');
    check((await membros(eletiva.id, tCoord)).json?.length === 4, 'Gestão vê os membros');
    check(codigo(await membros(INEXISTENTE)) === 'TURMA_NAO_ENCONTRADA', 'Turma inexistente → não encontrada');
    check(codigo(await membros('xyz')) === 'TURMA_NAO_ENCONTRADA', 'Id malformado → não encontrada');
    check((await call('GET', `/turmas/${eletiva.id}/membros`)).status === 401, 'Sem login não vê');

    console.log('\n— O que acontece em volta —');
    check((await call('DELETE', `/alunos/${eva.id}`, { token: tCoord })).status === 204, 'Gestão exclui um aluno...');
    check(nomes((await membros(eletiva.id)).json) === 'Ana,Bia,Caio', '...e ele sai da eletiva');
    check((await call('DELETE', `/turmas/${eletiva.id}`, { token: tA })).status === 204, 'O dono exclui a eletiva');
    check(
      (await prisma.turma_membros.count({ where: { turma_id: eletiva.id } })) === 0 &&
        (await prisma.alunos.count({ where: { id: { in: [ana.id, bia.id, caio.id] } } })) === 3,
      'Os vínculos saem, mas os alunos continuam nas turmas de origem',
    );
  } finally {
    server.close();
    // turmas.user_id não apaga em cascata (vira nulo); apagar as turmas leva junto alunos e membros.
    const turmas = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    console.log(`\n🧹 ${turmas.count} turmas (com alunos e membros) e ${count} usuários de teste apagados.`);
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
