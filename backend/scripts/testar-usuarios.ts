/**
 * Conferência da Fase 1, Parte 3: gestão de usuários pelo admin (listar, aprovar,
 * inativar, trocar papel, resetar senha). Cria usuários de teste temporários (e-mails
 * `teste-usuarios-*`), sobe a API numa porta livre, testa via HTTP e apaga os
 * usuários ao final. Não toca no admin real.
 *
 * Uso: npm run test:usuarios
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

const PREFIXO = `teste-usuarios-${Date.now()}`;
const SENHA = 'SenhaDeTeste123';
const email = (nome: string) => `${PREFIXO}-${nome}@prof.educacao.sp.gov.br`;
const INEXISTENTE = '00000000-0000-4000-8000-000000000000';

async function criarUsuario(nome: string, { status = 'ativo', roles = ['professor'] as app_role[] } = {}) {
  return prisma.usuarios.create({
    data: {
      email: email(nome),
      senha_hash: await hashPassword(SENHA),
      profile: { create: { nome: `Teste ${nome}`, email: email(nome), status } },
      user_roles: { create: roles.map((role) => ({ role })) },
    },
  });
}

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
  const entrar = (e: string, senha = SENHA) => call('POST', '/auth/login', { body: { email: e, senha } });
  const token = async (nome: string) => (await entrar(email(nome))).json.token as string;
  const codigo = (r: { json: { error?: { code: string } } | null }) => r.json?.error?.code;

  try {
    // Criados em sequência: a lista vem do mais novo para o mais antigo.
    const admin = await criarUsuario('admin', { roles: ['admin'] });
    await criarUsuario('admin2', { roles: ['admin'] });
    await criarUsuario('coord', { roles: ['coordenador'] });
    const prof = await criarUsuario('prof');
    const pend = await criarUsuario('pendente', { status: 'pendente' });
    const multi = await criarUsuario('multi', { roles: ['professor', 'coordenador'] });

    const tAdmin = await token('admin');
    const tCoord = await token('coord');
    const tProf = await token('prof');
    const lista = (query: string, t = tAdmin) => call('GET', `/users?${query}`, { token: t });
    const status = (id: string, s: unknown, t = tAdmin) => call('PATCH', `/users/${id}/status`, { token: t, body: { status: s } });
    const papel = (id: string, r: unknown, t = tAdmin) => call('PATCH', `/users/${id}/role`, { token: t, body: { role: r } });
    const reset = (id: string, t = tAdmin) => call('POST', `/users/${id}/reset-password`, { token: t });

    console.log('\n— Listar usuários —');
    const todos = await lista(`busca=${PREFIXO}`);
    check(todos.status === 200 && todos.json.length === 6, 'Admin lista os usuários (6 de teste)');
    check(todos.json[0]?.email === email('multi') && todos.json[5]?.email === email('admin'), 'Mais recentes primeiro');
    const linha = todos.json.find((u: { id: string }) => u.id === pend.id);
    check(
      linha?.nome === 'Teste pendente' && linha?.status === 'pendente' && linha?.role === 'professor' && 'created_at' in linha,
      'Cada linha traz nome, e-mail, status e papel (o que a tela usa)',
    );
    check(!todos.text.includes('senha_hash') && !todos.text.includes('$2'), 'Lista não expõe senhas criptografadas');
    check(todos.json.find((u: { id: string }) => u.id === multi.id)?.role === 'coordenador', 'Quem tem vários papéis aparece com o maior');
    const pendentes = await lista(`busca=${PREFIXO}&status=pendente`);
    check(pendentes.json.length === 1 && pendentes.json[0].id === pend.id, 'Filtro "pendentes" mostra só quem aguarda aprovação');
    check((await lista(`busca=TESTE%20PENDENTE`)).json.some((u: { id: string }) => u.id === pend.id), 'Busca por nome ignora maiúsculas');
    check(codigo(await lista('status=qualquer')) === 'DADOS_INVALIDOS', 'Filtro de status inválido → erro de dados');
    check((await lista(`busca=${PREFIXO}`, tCoord)).status === 200, 'Gestão (coordenação) também pode ver a lista');
    check(codigo(await lista('', tProf)) === 'SEM_PERMISSAO', 'Professor não vê a lista');
    check((await call('GET', '/users')).status === 401, 'Sem login não vê a lista');

    console.log('\n— Aprovar, inativar, reativar —');
    check((await entrar(email('pendente'))).status === 403, 'Antes da aprovação, o pendente não entra');
    check(codigo(await status(pend.id, 'ativo', tCoord)) === 'SEM_PERMISSAO', 'Gestão não aprova (só vê)');
    const aprovado = await status(pend.id, 'ativo');
    check(aprovado.status === 200 && aprovado.json.status === 'ativo', 'Admin aprova o cadastro pendente');
    check((await entrar(email('pendente'))).status === 200, 'Depois de aprovado, ele entra');

    const tPend = (await entrar(email('pendente'))).json.token;
    check((await status(pend.id, 'inativo')).json?.status === 'inativo', 'Admin inativa a conta');
    check(codigo(await call('GET', '/me', { token: tPend })) === 'CONTA_INATIVA', 'Inativado perde o acesso na hora, mesmo logado');
    check(codigo(await entrar(email('pendente'))) === 'CONTA_INATIVA', 'Inativado não consegue entrar');
    check((await status(pend.id, 'ativo')).json?.status === 'ativo', 'Admin reativa a conta');
    check((await call('GET', '/me', { token: tPend })).status === 200, 'Reativado volta a acessar');

    check(codigo(await status(pend.id, 'pendente')) === 'DADOS_INVALIDOS', 'Não dá para voltar alguém para "pendente"');
    check(codigo(await status(pend.id, 'xyz')) === 'DADOS_INVALIDOS', 'Status inventado → erro de dados');
    check(codigo(await call('PATCH', `/users/${pend.id}/status`, { token: tAdmin, body: {} })) === 'DADOS_INVALIDOS', 'Sem status → erro de dados');
    check(codigo(await status(admin.id, 'inativo')) === 'ACAO_EM_SI_MESMO', 'Admin não pode inativar a si mesmo');
    check(codigo(await status(INEXISTENTE, 'ativo')) === 'USUARIO_NAO_ENCONTRADO', 'Usuário inexistente → não encontrado');
    check(codigo(await status('nao-e-um-id', 'ativo')) === 'USUARIO_NAO_ENCONTRADO', 'Id malformado → não encontrado (sem erro interno)');

    console.log('\n— Trocar papel —');
    check(codigo(await lista('', tProf)) === 'SEM_PERMISSAO', 'Antes da promoção, o professor não vê a lista');
    const promovido = await papel(prof.id, 'coordenador');
    check(promovido.status === 200 && promovido.json.role === 'coordenador', 'Admin promove professor a coordenador');
    check((await lista(`busca=${PREFIXO}`, tProf)).status === 200, 'O novo papel vale na hora, sem precisar entrar de novo');
    const papeisMulti = await papel(multi.id, 'direcao');
    const linhasMulti = await prisma.user_roles.findMany({ where: { user_id: multi.id } });
    check(papeisMulti.json?.role === 'direcao' && linhasMulti.length === 1 && linhasMulti[0].role === 'direcao', 'Quem tinha vários papéis fica com exatamente um');
    check((await papel(prof.id, 'professor')).json?.role === 'professor', 'Admin rebaixa de volta a professor');
    check(codigo(await lista('', tProf)) === 'SEM_PERMISSAO', 'Rebaixado perde o acesso de gestão na hora');

    check(codigo(await papel(prof.id, 'diretor_geral')) === 'DADOS_INVALIDOS', 'Papel inventado → erro de dados');
    check(codigo(await papel(admin.id, 'professor')) === 'ACAO_EM_SI_MESMO', 'Admin não pode rebaixar a si mesmo');
    check(codigo(await papel(prof.id, 'admin', tCoord)) === 'SEM_PERMISSAO', 'Gestão não troca papéis');
    check(codigo(await papel(prof.id, 'admin', tProf)) === 'SEM_PERMISSAO', 'Professor não se promove a admin');
    check(codigo(await papel(INEXISTENTE, 'professor')) === 'USUARIO_NAO_ENCONTRADO', 'Usuário inexistente → não encontrado');
    check((await prisma.user_roles.count({ where: { user_id: INEXISTENTE } })) === 0, 'Nada foi gravado para o usuário inexistente');

    console.log('\n— Resetar senha —');
    const tProfAntes = await token('prof');
    const resetado = await reset(prof.id);
    const temporaria = resetado.json?.senha_temporaria as string;
    check(resetado.status === 200 && typeof temporaria === 'string' && temporaria.length >= 12, 'Admin reseta e recebe uma senha temporária');
    check(resetado.json?.usuario?.deve_trocar_senha === true, 'A pessoa fica marcada para trocar a senha');
    const salvo = await prisma.usuarios.findUnique({ where: { id: prof.id } });
    check(!!salvo && salvo.senha_hash !== temporaria && salvo.senha_hash.startsWith('$2'), 'Senha temporária guardada criptografada');
    check((await entrar(email('prof'))).status === 401, 'A senha antiga deixa de funcionar');
    check(codigo(await papel(prof.id, 'professor', tProfAntes)) === 'SENHA_TEMPORARIA', 'Sessão já aberta fica presa até trocar a senha');
    const comTemp = await entrar(email('prof'), temporaria);
    check(comTemp.status === 200 && comTemp.json.deve_trocar_senha === true, 'Entra com a senha temporária, avisado de que precisa trocar');
    const troca = await call('POST', '/auth/change-password', {
      token: comTemp.json.token,
      body: { senha_atual: temporaria, nova_senha: 'SenhaNova789' },
    });
    check(troca.status === 204 && (await entrar(email('prof'), 'SenhaNova789')).json.deve_trocar_senha === false, 'Troca a senha e volta ao normal');

    check(codigo(await reset(admin.id)) === 'ACAO_EM_SI_MESMO', 'Admin não reseta a própria senha (usa "trocar senha")');
    check(codigo(await reset(prof.id, tCoord)) === 'SEM_PERMISSAO', 'Gestão não reseta senhas');
    check(codigo(await reset(INEXISTENTE)) === 'USUARIO_NAO_ENCONTRADO', 'Usuário inexistente → não encontrado');

    console.log('\n— Vários admins —');
    const admin2 = await prisma.usuarios.findUniqueOrThrow({ where: { email: email('admin2') } });
    const tAdmin2 = await token('admin2');
    check((await papel(admin2.id, 'professor')).json?.role === 'professor', 'Um admin pode rebaixar outro admin');
    check(codigo(await lista('', tAdmin2)) === 'SEM_PERMISSAO', 'O admin rebaixado perde o acesso na hora');
    check((await lista(`busca=${PREFIXO}`)).status === 200, 'Quem rebaixou continua admin (sempre sobra pelo menos um)');
  } finally {
    server.close();
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    console.log(`\n🧹 ${count} usuários de teste apagados.`);
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
