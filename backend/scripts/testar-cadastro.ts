/**
 * Conferência da Fase 1, Parte 2: cadastro, papéis nas rotas e limite de tentativas.
 * Cria usuários de teste temporários (e-mails `teste-cadastro-*`), sobe a API numa
 * porta livre, testa via HTTP e apaga os usuários ao final. Não toca no admin.
 *
 * Os limites de tentativa ficam baixos só aqui, e cada bloco de teste "vem" de um IP
 * diferente (cabeçalho X-Forwarded-For, como o Render faz), para um não afetar o outro.
 *
 * Uso: npm run test:cadastro
 */
import 'dotenv/config';
import type { AddressInfo } from 'node:net';
import type { RequestHandler } from 'express';
import type { app_role } from '@prisma/client';

process.env.LOGIN_MAX_TENTATIVAS = '3';
process.env.CADASTRO_MAX_POR_HORA = '2';
process.env.TRUST_PROXY = '1';

let falhas = 0;
function check(ok: boolean, descricao: string) {
  console.log(`${ok ? '✅' : '❌'} ${descricao}`);
  if (!ok) falhas++;
}

const PREFIXO = `teste-cadastro-${Date.now()}`;
const DOMINIO = 'prof.educacao.sp.gov.br';
const SENHA = 'SenhaDeTeste123';
const email = (nome: string) => `${PREFIXO}-${nome}@${DOMINIO}`;

let ipSeq = 0;
/** Um IP falso novo, para o pedido não contar no limite de nenhum outro. */
const novoIp = () => `10.0.${Math.floor(++ipSeq / 250)}.${(ipSeq % 250) + 1}`;

async function main() {
  // Importados depois de ajustar o process.env acima, para os limites de teste valerem.
  const express = (await import('express')).default;
  const { app } = await import('../src/app');
  const { prisma } = await import('../src/lib/prisma');
  const { hashPassword } = await import('../src/lib/password');
  const { requireRole, GESTAO } = await import('../src/middlewares/roles');
  const { errorHandler } = await import('../src/middlewares/error-handler');

  async function criarUsuario(nome: string, role: app_role, deve_trocar_senha = false) {
    return prisma.usuarios.create({
      data: {
        email: email(nome),
        senha_hash: await hashPassword(SENHA),
        deve_trocar_senha,
        profile: { create: { nome: `Teste ${nome}`, email: email(nome), status: 'ativo' } },
        user_roles: { create: { role } },
      },
    });
  }

  // Rotas de exemplo só para o teste (as rotas reais com papel chegam nas próximas fases).
  const ok: RequestHandler = (_req, res) => {
    res.json({ ok: true });
  };
  const harness = express();
  harness.set('trust proxy', 1);
  harness.get('/__gestao', requireRole(...GESTAO), ok);
  harness.get('/__admin', requireRole('admin'), ok);
  harness.get('/__coordenacao', requireRole('coordenador'), ok);
  harness.use(app);
  harness.use(errorHandler);
  const server = harness.listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;

  async function call(method: string, path: string, { body, token, ip = novoIp() }: { body?: unknown; token?: string; ip?: string } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': ip,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, text, json: text ? JSON.parse(text) : null };
  }
  const cadastrar = (body: object, ip?: string) => call('POST', '/auth/signup', { body, ip });
  const entrar = (e: string, senha = SENHA, ip?: string) => call('POST', '/auth/login', { body: { email: e, senha }, ip });
  const codigo = (r: { json: { error?: { code: string } } | null }) => r.json?.error?.code;

  try {
    console.log('\n— Cadastro —');
    const novo = await cadastrar({ nome: '  Maria   da Silva ', email: `  ${email('maria').toUpperCase()} `, senha: SENHA });
    check(novo.status === 201, 'Cadastro com e-mail institucional é aceito');
    check(
      novo.json?.profile?.status === 'pendente' && novo.json?.role === 'professor' && novo.json?.deve_trocar_senha === false,
      'Conta nasce pendente, como professor',
    );
    check(!('token' in (novo.json ?? {})), 'Cadastro não devolve token (só entra depois de aprovado)');
    check(!novo.text.includes('senha_hash') && !novo.text.includes('$2'), 'Resposta não expõe a senha criptografada');

    const salvo = await prisma.usuarios.findUnique({
      where: { email: email('maria') },
      include: { profile: true, user_roles: true },
    });
    check(salvo?.profile?.nome === 'Maria da Silva', 'Nome salvo sem espaços sobrando');
    check(salvo?.profile?.email === email('maria'), 'E-mail salvo em minúsculas e sem espaços');
    check(salvo?.user_roles.length === 1 && salvo.user_roles[0].role === 'professor', 'Exatamente um papel: professor');
    check(!!salvo && salvo.senha_hash !== SENHA && salvo.senha_hash.startsWith('$2'), 'Senha guardada criptografada');

    const pendente = await entrar(email('maria'));
    check(pendente.status === 403 && codigo(pendente) === 'CONTA_PENDENTE', 'Recém-cadastrado não entra até ser aprovado');
    await prisma.profiles.update({ where: { id: salvo!.id }, data: { status: 'ativo' } });
    check((await entrar(email('maria'))).status === 200, 'Depois de aprovado, entra normalmente');

    const repetido = await cadastrar({ nome: 'Outra', email: email('MARIA'), senha: SENHA });
    check(repetido.status === 409 && codigo(repetido) === 'EMAIL_JA_CADASTRADO', 'E-mail já cadastrado é recusado (mesmo com maiúsculas)');

    const esperto = await cadastrar({ nome: 'Esperto', email: email('esperto'), senha: SENHA, status: 'ativo', role: 'admin', deve_trocar_senha: true });
    check(
      esperto.status === 201 && esperto.json.profile.status === 'pendente' && esperto.json.role === 'professor',
      'Mandar status/papel no cadastro não adianta: continua pendente e professor',
    );

    console.log('\n— Cadastro: e-mails recusados —');
    for (const [e, desc] of [
      [`${PREFIXO}@gmail.com`, 'Outro domínio (gmail)'],
      [`${PREFIXO}@educacao.sp.gov.br`, 'Domínio parecido (sem "prof.")'],
      [`${PREFIXO}@x.${DOMINIO}`, 'Subdomínio do institucional'],
      [`${PREFIXO}@${DOMINIO}.evil.com`, 'Institucional "disfarçado" no começo de outro domínio'],
    ]) {
      check(codigo(await cadastrar({ nome: 'X', email: e, senha: SENHA })) === 'DOMINIO_NAO_PERMITIDO', `${desc} é recusado`);
    }
    for (const [e, desc] of [
      [`a@b@${DOMINIO}`, 'Dois @'],
      [`@${DOMINIO}`, 'Sem nada antes do @'],
      [`maria silva@${DOMINIO}`, 'Espaço no meio'],
      [`${PREFIXO}-sem-arroba`, 'Sem @'],
    ]) {
      check(codigo(await cadastrar({ nome: 'X', email: e, senha: SENHA })) === 'EMAIL_INVALIDO', `${desc} → e-mail inválido`);
    }

    console.log('\n— Cadastro: senha e nome —');
    check(codigo(await cadastrar({ nome: 'X', email: email('curta'), senha: '1234567' })) === 'SENHA_FRACA', 'Senha com menos de 8 caracteres é recusada');
    check(codigo(await cadastrar({ nome: 'X', email: email('longa'), senha: 'a'.repeat(73) })) === 'SENHA_LONGA', 'Senha acima de 72 caracteres é recusada');
    check(codigo(await cadastrar({ nome: '   ', email: email('semnome'), senha: SENHA })) === 'DADOS_INVALIDOS', 'Nome só com espaços é recusado');
    check(codigo(await cadastrar({ nome: 'x'.repeat(121), email: email('nomelongo'), senha: SENHA })) === 'DADOS_INVALIDOS', 'Nome com mais de 120 caracteres é recusado');
    check(codigo(await cadastrar({ email: email('faltando'), senha: SENHA })) === 'DADOS_INVALIDOS', 'Faltando o nome → erro de dados');
    check(codigo(await cadastrar({ nome: 'X', email: email('numero'), senha: 12345678 })) === 'DADOS_INVALIDOS', 'Senha que não é texto → erro de dados');
    const recusados = await prisma.usuarios.count({
      where: { email: { in: ['curta', 'longa', 'semnome', 'nomelongo', 'faltando', 'numero'].map(email) } },
    });
    check(recusados === 0, 'Nenhum cadastro recusado foi gravado no banco');

    console.log('\n— Papéis nas rotas —');
    const tokens: Partial<Record<app_role | 'temporario', string>> = {};
    for (const role of ['professor', 'coordenador', 'direcao', 'vice_direcao', 'admin'] as app_role[]) {
      await criarUsuario(role, role);
      tokens[role] = (await entrar(email(role))).json.token;
    }
    await criarUsuario('admin-temporario', 'admin', true);
    tokens.temporario = (await entrar(email('admin-temporario'))).json.token;

    const acesso = async (path: string, quem: keyof typeof tokens) => call('GET', path, { token: tokens[quem] });
    const prof = await acesso('/__gestao', 'professor');
    check(prof.status === 403 && codigo(prof) === 'SEM_PERMISSAO', 'Professor não acessa rota de gestão');
    check((await acesso('/__admin', 'professor')).status === 403, 'Professor não acessa rota de admin');
    for (const role of ['coordenador', 'direcao', 'vice_direcao'] as const) {
      check((await acesso('/__gestao', role)).status === 200, `${role} acessa rota de gestão`);
      check((await acesso('/__admin', role)).status === 403, `${role} não acessa rota de admin`);
    }
    check((await acesso('/__gestao', 'admin')).status === 200, 'Admin acessa rota de gestão');
    check((await acesso('/__admin', 'admin')).status === 200, 'Admin acessa rota de admin');
    check((await acesso('/__coordenacao', 'admin')).status === 200, 'Admin passa até em rota de um papel específico');
    check((await acesso('/__coordenacao', 'direcao')).status === 403, 'Rota só da coordenação barra a direção');
    const semLogin = await call('GET', '/__gestao');
    check(semLogin.status === 401 && codigo(semLogin) === 'NAO_AUTENTICADO', 'Sem login, a resposta é "faça login" (401), não "sem permissão"');
    const temp = await acesso('/__admin', 'temporario');
    check(temp.status === 403 && codigo(temp) === 'SENHA_TEMPORARIA', 'Admin com senha temporária também é barrado até trocar');

    console.log('\n— Limite de tentativas —');
    const ipA = novoIp();
    for (let i = 1; i <= 3; i++) await entrar(email('professor'), 'senha-errada', ipA);
    const bloqueado = await entrar(email('professor'), 'senha-errada', ipA);
    check(bloqueado.status === 429 && codigo(bloqueado) === 'MUITAS_TENTATIVAS', 'Após 3 senhas erradas, o 4º login do mesmo IP é bloqueado');
    check((await entrar(email('professor'), SENHA, ipA)).status === 429, 'Bloqueado vale até para a senha certa (quem chuta não descobre que acertou)');
    check((await entrar(email('professor'), SENHA, novoIp())).status === 200, 'Outro IP continua entrando normalmente');
    const ipB = novoIp();
    for (let i = 1; i <= 5; i++) await entrar(email('professor'), SENHA, ipB);
    check((await entrar(email('professor'), 'senha-errada', ipB)).status === 401, 'Logins certos não contam para o limite');

    const ipC = novoIp();
    await cadastrar({ nome: 'Limite 1', email: email('limite1'), senha: SENHA }, ipC);
    await cadastrar({ nome: 'Limite 2', email: email('limite2'), senha: SENHA }, ipC);
    const cadastroBloqueado = await cadastrar({ nome: 'Limite 3', email: email('limite3'), senha: SENHA }, ipC);
    check(cadastroBloqueado.status === 429 && codigo(cadastroBloqueado) === 'MUITAS_TENTATIVAS', 'Muitos cadastros do mesmo IP são bloqueados');
    check(!(await prisma.usuarios.findUnique({ where: { email: email('limite3') } })), 'Cadastro bloqueado não foi gravado');
  } finally {
    server.close();
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    console.log(`\n🧹 ${count} usuários de teste apagados.`);
    await prisma.$disconnect();
  }

  console.log(falhas === 0 ? '\nTudo certo ✅' : `\n${falhas} falha(s) ❌`);
  if (falhas) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
