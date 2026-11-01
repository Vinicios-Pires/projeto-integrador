/**
 * Conferência da Fase 2, Parte 1: turmas (listar, ver, criar, editar, excluir) e o
 * padrão A de autorização (dono altera, gestão só lê, admin pode tudo). Cria usuários
 * de teste temporários (e-mails `teste-turmas-*`), sobe a API numa porta livre, testa
 * via HTTP e apaga tudo ao final (turmas, alunos e usuários). Não toca no admin real.
 *
 * Uso: npm run test:turmas
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

const PREFIXO = `teste-turmas-${Date.now()}`;
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

type Turma = { id: string; nome: string; user_id: string | null; alunos_count: number; membros_count: number };

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
    await criarUsuario('coord', 'coordenador');
    const profA = await criarUsuario('profa', 'professor');
    const profB = await criarUsuario('profb', 'professor');
    ids.push(admin.id, profA.id, profB.id);

    const tAdmin = await token('admin');
    const tCoord = await token('coord');
    const tA = await token('profa');
    const tB = await token('profb');
    const criar = (body: unknown, t = tA) => call('POST', '/turmas', { token: t, body });
    const ver = (id: string, t = tA) => call('GET', `/turmas/${id}`, { token: t });
    const editar = (id: string, body: unknown, t = tA) => call('PATCH', `/turmas/${id}`, { token: t, body });
    const excluir = (id: string, t = tA) => call('DELETE', `/turmas/${id}`, { token: t });
    const listar = async (t: string) => (await call('GET', '/turmas', { token: t })).json as Turma[];
    const nomes = (lista: Turma[]) => lista.map((t) => t.nome).filter((n) => n.startsWith(PREFIXO));

    console.log('\n— Criar —');
    const t1 = await criar({ nome: `${PREFIXO} 7A`, serie: '7º Ano' });
    check(t1.status === 201 && t1.json.user_id === profA.id, 'Professor cria turma e fica como dono');
    check(
      t1.json?.turno === 'Manhã' && t1.json?.tipo === 'regular' && t1.json?.capacidade === 35 &&
        t1.json?.ano_letivo === new Date().getFullYear(),
      'Valores padrão: Manhã, regular, 35 vagas, ano atual',
    );
    check(t1.json?.alunos_count === 0 && t1.json?.membros_count === 0 && 'created_at' in t1.json, 'Resposta traz colunas e contagens');
    const t2 = await criar({
      nome: `${PREFIXO} 6B`, serie: '6º Ano', turno: 'Tarde', ano_letivo: 2026, capacidade: 30, observacoes: 'sala 4',
    });
    check(t2.status === 201 && t2.json.turno === 'Tarde' && t2.json.capacidade === 30 && t2.json.observacoes === 'sala 4', 'Cria com todos os campos da tela');
    const tP = await criar({ nome: `${PREFIXO} Eletiva Robótica`, serie: 'Ensino Médio', tipo: 'personalizada', user_id: profB.id });
    check(tP.status === 201 && tP.json.tipo === 'personalizada', 'Cria turma personalizada (eletiva)');
    check(tP.json?.user_id === profA.id, 'Mandar outro "user_id" no corpo é ignorado (dono é quem cria)');
    const tB1 = await criar({ nome: `${PREFIXO} 9C`, serie: '9º Ano' }, tB);
    const tAd = await criar({ nome: `${PREFIXO} 1EM`, serie: '1º Ano EM' }, tAdmin);
    check(tB1.status === 201 && tAd.status === 201 && tAd.json.user_id === admin.id, 'Outro professor e o admin também criam');
    const tCo = await criar({ nome: `${PREFIXO} Coord`, serie: '8º Ano' }, tCoord);
    check(tCo.status === 201, 'Gestão também pode criar a própria turma');
    if (tCo.status === 201) await prisma.turmas.delete({ where: { id: tCo.json.id } });

    console.log('\n— Validação —');
    check(codigo(await criar({ serie: '7º Ano' })) === 'DADOS_INVALIDOS', 'Sem nome → erro de dados');
    check(codigo(await criar({ nome: '   ', serie: '7º Ano' })) === 'DADOS_INVALIDOS', 'Nome só com espaços → erro de dados');
    check(codigo(await criar({ nome: 'X' })) === 'DADOS_INVALIDOS', 'Sem série → erro de dados');
    check(codigo(await criar({ nome: 'X', serie: 'Y', turno: 'Madrugada' })) === 'DADOS_INVALIDOS', 'Turno inventado → erro de dados');
    check(codigo(await criar({ nome: 'X', serie: 'Y', tipo: 'outro' })) === 'DADOS_INVALIDOS', 'Tipo inventado → erro de dados');
    check(codigo(await criar({ nome: 'X', serie: 'Y', capacidade: 0 })) === 'DADOS_INVALIDOS', 'Capacidade zero → erro de dados');
    check(codigo(await criar({ nome: 'X', serie: 'Y', capacidade: '35' })) === 'DADOS_INVALIDOS', 'Capacidade em texto → erro de dados');
    check(codigo(await criar({ nome: 'X', serie: 'Y', ano_letivo: 2026.5 })) === 'DADOS_INVALIDOS', 'Ano letivo quebrado → erro de dados');
    check(codigo(await criar({ nome: 'X', serie: 'Y', observacoes: 5 })) === 'DADOS_INVALIDOS', 'Observações que não são texto → erro de dados');
    check((await call('POST', '/turmas', { body: { nome: 'X', serie: 'Y' } })).status === 401, 'Sem login não cria');
    check((await prisma.turmas.count({ where: { nome: 'X', user_id: { in: ids } } })) === 0, 'Nenhuma turma inválida foi gravada');

    console.log('\n— Listar e ver —');
    // Alunos e membros gravados direto no banco (as rotas deles vêm nas próximas partes).
    await prisma.alunos.createMany({
      data: [1, 2, 3].map((n) => ({ nome: `${PREFIXO} aluno ${n}`, turma_id: t1.json.id, numero_chamada: n })),
    });
    const alunos = await prisma.alunos.findMany({ where: { turma_id: t1.json.id } });
    await prisma.turma_membros.createMany({
      data: alunos.slice(0, 2).map((a) => ({ turma_id: tP.json.id, aluno_id: a.id, user_id: profA.id })),
    });

    const listaA = await listar(tA);
    check(
      JSON.stringify(nomes(listaA)) === JSON.stringify([`${PREFIXO} 6B`, `${PREFIXO} 7A`, `${PREFIXO} Eletiva Robótica`]),
      'Professor vê só as próprias turmas, em ordem de nome',
    );
    check(listaA.every((t) => t.user_id === profA.id), 'Nenhuma turma de outro professor na lista dele');
    const l1 = listaA.find((t) => t.id === t1.json.id);
    const lP = listaA.find((t) => t.id === tP.json.id);
    check(l1?.alunos_count === 3 && lP?.membros_count === 2, 'Contagem de alunos e de membros da eletiva');
    check(JSON.stringify(nomes(await listar(tB))) === JSON.stringify([`${PREFIXO} 9C`]), 'O outro professor também só vê as dele');
    check(nomes(await listar(tCoord)).length === 5, 'Gestão (coordenação) vê as turmas de todos');
    check(nomes(await listar(tAdmin)).length === 5, 'Admin vê as turmas de todos');
    check((await call('GET', '/turmas')).status === 401, 'Sem login não lista');

    const v1 = await ver(t1.json.id);
    check(v1.status === 200 && v1.json.alunos_count === 3, 'Dono vê a turma pelo id');
    check(codigo(await ver(t1.json.id, tB)) === 'TURMA_NAO_ENCONTRADA', 'Professor B não vê turma do professor A (como se não existisse)');
    check((await ver(t1.json.id, tCoord)).status === 200, 'Gestão vê a turma de qualquer professor');
    check(codigo(await ver(INEXISTENTE)) === 'TURMA_NAO_ENCONTRADA', 'Turma inexistente → não encontrada');
    check(codigo(await ver('nao-e-um-id')) === 'TURMA_NAO_ENCONTRADA', 'Id malformado → não encontrada (sem erro interno)');

    console.log('\n— Editar —');
    const e1 = await editar(t1.json.id, { turno: 'Integral' });
    check(e1.status === 200 && e1.json.turno === 'Integral' && e1.json.nome === `${PREFIXO} 7A`, 'Dono altera só o campo enviado');
    check(new Date(e1.json.updated_at) > new Date(t1.json.updated_at), 'Data de atualização muda');
    const form = { nome: `${PREFIXO} 7A`, serie: '7º Ano', turno: 'Manhã', ano_letivo: 2026, capacidade: 40, observacoes: '' };
    const e2 = await editar(t1.json.id, form);
    check(e2.status === 200 && e2.json.capacidade === 40 && e2.json.observacoes === null, 'Aceita o formulário inteiro da tela (observação vazia vira nula)');
    check((await editar(t1.json.id, { user_id: profB.id, nome: `${PREFIXO} 7A` })).json?.user_id === profA.id, 'Não dá para passar a turma para outro dono');
    check(codigo(await editar(t1.json.id, { nome: '' })) === 'DADOS_INVALIDOS', 'Apagar o nome → erro de dados');
    check(codigo(await editar(t1.json.id, { ano_letivo: null })) === 'DADOS_INVALIDOS', 'Ano letivo vazio → erro de dados');
    check(codigo(await editar(t1.json.id, {})) === 'DADOS_INVALIDOS', 'Nada para alterar → erro de dados');
    check(codigo(await editar(t1.json.id, { turno: 'Tarde' }, tB)) === 'TURMA_NAO_ENCONTRADA', 'Professor B não altera turma do A');
    check(codigo(await editar(t1.json.id, { turno: 'Tarde' }, tCoord)) === 'SEM_PERMISSAO', 'Gestão vê, mas não altera turma de professor');
    check((await editar(t1.json.id, { capacidade: 38 }, tAdmin)).json?.capacidade === 38, 'Admin altera turma de qualquer professor');
    check((await prisma.turmas.findUnique({ where: { id: t1.json.id } }))?.turno === 'Manhã', 'As tentativas barradas não mudaram nada');
    check(codigo(await editar(INEXISTENTE, { turno: 'Tarde' })) === 'TURMA_NAO_ENCONTRADA', 'Turma inexistente → não encontrada');

    console.log('\n— Excluir —');
    check(codigo(await excluir(t1.json.id, tB)) === 'TURMA_NAO_ENCONTRADA', 'Professor B não exclui turma do A');
    check(codigo(await excluir(t1.json.id, tCoord)) === 'SEM_PERMISSAO', 'Gestão não exclui turma de professor');
    const comAlunos = await excluir(t1.json.id);
    check(comAlunos.status === 409 && codigo(comAlunos) === 'TURMA_COM_ALUNOS', 'Turma com alunos não pode ser excluída');
    check(codigo(await excluir(t1.json.id, tAdmin)) === 'TURMA_COM_ALUNOS', 'Nem pelo admin');
    await prisma.alunos.updateMany({ where: { turma_id: t1.json.id }, data: { ativo: false } });
    check(codigo(await excluir(t1.json.id)) === 'TURMA_COM_ALUNOS', 'Alunos inativos também contam');
    check((await prisma.alunos.count({ where: { turma_id: t1.json.id } })) === 3, 'A turma e os alunos continuam lá');

    check((await excluir(tP.json.id)).status === 204, 'Eletiva com membros (sem alunos próprios) pode ser excluída');
    check(
      (await prisma.turma_membros.count({ where: { turma_id: tP.json.id } })) === 0 &&
        (await prisma.alunos.count({ where: { id: { in: alunos.map((a) => a.id) } } })) === 3,
      'Os vínculos da eletiva saem junto, mas os alunos continuam existindo',
    );
    await prisma.alunos.updateMany({ where: { turma_id: t1.json.id }, data: { turma_id: t2.json.id } });
    check((await excluir(t1.json.id)).status === 204, 'Depois de mover os alunos, o dono exclui a turma');
    check(codigo(await ver(t1.json.id)) === 'TURMA_NAO_ENCONTRADA', 'Depois de excluída, não aparece mais');
    check((await excluir(tB1.json.id, tAdmin)).status === 204, 'Admin exclui turma vazia de qualquer professor');
    check(codigo(await excluir(INEXISTENTE)) === 'TURMA_NAO_ENCONTRADA', 'Turma inexistente → não encontrada');
  } finally {
    server.close();
    // turmas.user_id não apaga em cascata (vira nulo), então as turmas saem primeiro.
    const turmas = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    await prisma.alunos.deleteMany({ where: { nome: { startsWith: PREFIXO } } });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    console.log(`\n🧹 ${turmas.count} turmas e ${count} usuários de teste apagados.`);
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
