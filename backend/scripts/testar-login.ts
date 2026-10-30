/**
 * Conferência do login (Fase 1, Parte 1): entrar, token, /me e troca de senha.
 * Cria usuários de teste temporários (e-mails `teste-login-*`), sobe a API numa
 * porta livre, testa via HTTP e apaga os usuários ao final. Não toca no admin.
 *
 * Uso: npm run test:login
 */
import 'dotenv/config';
import type { AddressInfo } from 'node:net';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { app_role } from '@prisma/client';
import { app } from '../src/app';
import { env } from '../src/lib/env';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { requireAuth } from '../src/middlewares/auth';
import { errorHandler } from '../src/middlewares/error-handler';

let falhas = 0;
function check(ok: boolean, descricao: string) {
  console.log(`${ok ? '✅' : '❌'} ${descricao}`);
  if (!ok) falhas++;
}

const PREFIXO = `teste-login-${Date.now()}`;
const SENHA = 'SenhaDeTeste123';
const email = (nome: string) => `${PREFIXO}-${nome}@prof.educacao.sp.gov.br`;

async function criarUsuario(
  nome: string,
  { status = 'ativo', roles = ['professor'] as app_role[], deve_trocar_senha = false } = {},
) {
  return prisma.usuarios.create({
    data: {
      email: email(nome),
      senha_hash: await hashPassword(SENHA),
      deve_trocar_senha,
      profile: { create: { nome: `Teste ${nome}`, email: email(nome), status } },
      user_roles: { create: roles.map((role) => ({ role })) },
    },
  });
}

async function main() {
  const ativo = await criarUsuario('ativo');
  await criarUsuario('pendente', { status: 'pendente' });
  await criarUsuario('inativo', { status: 'inativo' });
  await criarUsuario('temporaria', { deve_trocar_senha: true });
  await criarUsuario('gestor', { roles: ['professor', 'coordenador', 'admin'] });

  // App principal + uma rota protegida "comum" só para o teste (nenhuma existe ainda).
  const harness = express();
  harness.get('/__protegida', requireAuth(), (_req, res) => res.json({ ok: true }));
  harness.use(app);
  harness.use(errorHandler);
  const server = harness.listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;

  async function call(method: string, path: string, { body, token, raw }: { body?: unknown; token?: string; raw?: string } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    const text = await res.text();
    return { status: res.status, text, json: text ? JSON.parse(text) : null };
  }
  const entrar = (e: string, senha = SENHA) => call('POST', '/auth/login', { body: { email: e, senha } });

  try {
    console.log('\n— Entrar —');
    const ok = await entrar(email('ativo'));
    check(ok.status === 200 && typeof ok.json.token === 'string', 'Usuário ativo entra e recebe token');
    check(
      ok.json.role === 'professor' && ok.json.profile?.status === 'ativo' && ok.json.deve_trocar_senha === false,
      'Resposta traz papel, perfil e aviso de troca de senha',
    );
    check(!ok.text.includes('senha_hash') && !ok.text.includes('$2'), 'Resposta não expõe a senha criptografada');
    check((await entrar(`  ${email('ativo').toUpperCase()} `)).status === 200, 'E-mail com maiúsculas/espaços também entra');

    const errada = await entrar(email('ativo'), 'senha-errada');
    const inexistente = await entrar(email('nao-existe'));
    check(errada.status === 401 && errada.json.error.code === 'CREDENCIAIS_INVALIDAS', 'Senha errada é recusada');
    check(
      inexistente.status === 401 && inexistente.text === errada.text,
      'E-mail inexistente recebe exatamente a mesma resposta (não revela quem tem conta)',
    );

    const pendente = await entrar(email('pendente'));
    check(pendente.status === 403 && pendente.json.error.code === 'CONTA_PENDENTE', 'Cadastro pendente não entra (aguardando aprovação)');
    const inativo = await entrar(email('inativo'));
    check(inativo.status === 403 && inativo.json.error.code === 'CONTA_INATIVA', 'Conta inativa não entra');
    check((await entrar(email('pendente'), 'senha-errada')).status === 401, 'Pendente com senha errada não descobre que está pendente');

    check((await call('POST', '/auth/login', { body: { email: email('ativo') } })).status === 400, 'Faltando a senha → erro de dados');
    check((await call('POST', '/auth/login', { raw: '{ isso não é json' })).status === 400, 'Corpo malformado → erro de dados (não derruba o servidor)');

    const gestor = await entrar(email('gestor'));
    check(gestor.json.role === 'admin', 'Com vários papéis, vale o de maior permissão (admin)');

    console.log('\n— Quem sou eu (/me) —');
    const token = ok.json.token as string;
    const me = await call('GET', '/me', { token });
    check(me.status === 200 && me.json.user.id === ativo.id && me.json.user.email === email('ativo'), '/me devolve o dono do token');
    check((await call('GET', '/me')).status === 401, '/me sem token é recusado');
    check((await call('GET', '/me', { token: 'abc.def.ghi' })).status === 401, '/me com token inventado é recusado');
    const forjado = jwt.sign({}, 'outro-segredo', { subject: ativo.id });
    check((await call('GET', '/me', { token: forjado })).status === 401, '/me com token assinado por outro segredo é recusado');
    const expirado = jwt.sign({ exp: Math.floor(Date.now() / 1000) - 60 }, env.JWT_SECRET, { subject: ativo.id });
    check((await call('GET', '/me', { token: expirado })).status === 401, '/me com token vencido é recusado');
    check((await call('GET', '/__protegida', { token })).status === 200, 'Usuário ativo acessa rota protegida');

    console.log('\n— Senha temporária e troca de senha —');
    const temp = await entrar(email('temporaria'));
    const tokenTemp = temp.json.token as string;
    check(temp.status === 200 && temp.json.deve_trocar_senha === true, 'Senha temporária entra, avisando que precisa trocar');
    check((await call('GET', '/me', { token: tokenTemp })).status === 200, 'Com senha temporária, /me funciona');
    const barrado = await call('GET', '/__protegida', { token: tokenTemp });
    check(barrado.status === 403 && barrado.json.error.code === 'SENHA_TEMPORARIA', 'Com senha temporária, o resto do sistema fica bloqueado');

    const trocar = (body: object, t = tokenTemp) => call('POST', '/auth/change-password', { token: t, body });
    check((await trocar({ senha_atual: 'errada', nova_senha: 'NovaSenha456' })).json?.error.code === 'SENHA_ATUAL_INCORRETA', 'Troca recusada com senha atual errada');
    check((await trocar({ senha_atual: SENHA, nova_senha: 'curta' })).json?.error.code === 'SENHA_FRACA', 'Troca recusada com senha nova curta (< 8)');
    check((await trocar({ senha_atual: SENHA, nova_senha: SENHA })).json?.error.code === 'SENHA_REPETIDA', 'Troca recusada com senha nova igual à atual');
    check((await call('POST', '/auth/change-password', { body: { senha_atual: SENHA, nova_senha: 'NovaSenha456' } })).status === 401, 'Troca sem token é recusada');
    check((await trocar({ senha_atual: SENHA, nova_senha: 'NovaSenha456' })).status === 204, 'Troca de senha aceita');
    check((await call('GET', '/__protegida', { token: tokenTemp })).status === 200, 'Depois da troca, o sistema é liberado');
    check((await entrar(email('temporaria'))).status === 401, 'Senha antiga deixa de funcionar');
    const nova = await entrar(email('temporaria'), 'NovaSenha456');
    check(nova.status === 200 && nova.json.deve_trocar_senha === false, 'Senha nova funciona e o aviso de troca some');

    console.log('\n— Corte imediato de acesso —');
    await prisma.profiles.update({ where: { id: ativo.id }, data: { status: 'inativo' } });
    const cortado = await call('GET', '/me', { token });
    check(cortado.status === 403 && cortado.json.error.code === 'CONTA_INATIVA', 'Inativar a conta corta o acesso na hora, mesmo com token ainda válido');

    check((await call('GET', '/rota-que-nao-existe')).status === 404, 'Rota inexistente → 404');
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
