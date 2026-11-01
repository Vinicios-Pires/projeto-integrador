/**
 * Base das conferências de tela (Fase 6): sobe a API e o frontend (Vite) em portas livres, abre o
 * Chromium do Playwright (instalado no frontend) e oferece atalhos para entrar e procurar textos.
 * Os usuários de teste usam o prefixo recebido e são apagados por `fechar()`.
 */
import 'dotenv/config';
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer, type AddressInfo } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { app_role } from '@prisma/client';

const FRONTEND = path.resolve(__dirname, '../../frontend');

export const SENHA = 'SenhaDeTeste123';

let falhas = 0;
export function check(ok: boolean, descricao: string) {
  console.log(`${ok ? '✅' : '❌'} ${descricao}`);
  if (!ok) falhas++;
}

function portaLivre(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, () => {
      const { port } = srv.address() as AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

async function esperarNoAr(url: string, ms = 90_000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} não respondeu a tempo.`);
}

export async function abrirTelas(prefixo: string) {
  const portaFront = await portaLivre();
  const front = `http://localhost:${portaFront}`;
  // A API lê a configuração ao ser carregada: só o frontend deste teste é liberado, e os arquivos
  // enviados pelas telas ficam numa pasta temporária, apagada no final.
  process.env.CORS_ORIGINS = front;
  const pastaArquivos = await mkdtemp(path.join(tmpdir(), `${prefixo}-arquivos-`));
  process.env.STORAGE_DRIVER = 'local';
  process.env.STORAGE_LOCAL_DIR = pastaArquivos;
  const { app } = await import('../src/app');
  const { prisma } = await import('../src/lib/prisma');
  const { hashPassword } = await import('../src/lib/password');

  const email = (nome: string) => `${prefixo}-${nome}@prof.educacao.sp.gov.br`;
  const criarUsuario = async (nome: string, { status = 'ativo', roles = ['professor'] as app_role[] } = {}) =>
    prisma.usuarios.create({
      data: {
        email: email(nome),
        senha_hash: await hashPassword(SENHA),
        profile: { create: { nome: `Teste ${nome}`, email: email(nome), status } },
        user_roles: { create: roles.map((role) => ({ role })) },
      },
    });

  const server = app.listen(0);
  const api = `http://localhost:${(server.address() as AddressInfo).port}`;

  const vite: ChildProcess = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--port', String(portaFront), '--strictPort', '--host', 'localhost'],
    { cwd: FRONTEND, env: { ...process.env, VITE_API_URL: api }, stdio: 'ignore' },
  );
  let browser: { close(): Promise<void>; newPage(): Promise<any> } | undefined;
  let page: any;

  /**
   * Fecha tudo e apaga os dados de teste. Com `erro` (a conferência parou no meio), conta como falha
   * e guarda uma foto da tela para investigar.
   */
  const fechar = async (limparDados?: () => Promise<unknown>, erro?: unknown) => {
    if (erro !== undefined) {
      console.error(erro);
      check(false, 'A conferência chegou até o fim');
      const foto = path.join(tmpdir(), `${prefixo}-erro.png`);
      if (await page?.screenshot({ path: foto, fullPage: true }).then(() => true, () => false)) console.log(`📷 Tela no momento do erro: ${foto}`);
    }
    await browser?.close().catch(() => {});
    vite.kill();
    server.close();
    await limparDados?.();
    await rm(pastaArquivos, { recursive: true, force: true });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: prefixo } } });
    console.log(`\n🧹 ${count} usuários de teste apagados.`);
    await prisma.$disconnect();
    console.log(falhas === 0 ? '\nTudo certo ✅' : `\n${falhas} falha(s) ❌`);
    if (falhas) process.exitCode = 1;
  };

  try {
    await esperarNoAr(front);
    const { chromium } = createRequire(path.join(FRONTEND, 'package.json'))('@playwright/test');
    browser = await chromium.launch();
  } catch (err) {
    await fechar();
    throw err;
  }
  page = await browser!.newPage();
  page.setDefaultTimeout(30_000);
  // As confirmações do navegador ("Excluir…?") são aceitas.
  page.on('dialog', (d: { accept(): Promise<void> }) => d.accept());

  const visivel = (texto: string | RegExp, timeout = 15_000) =>
    page.getByText(texto).first().waitFor({ state: 'visible', timeout }).then(() => true, () => false);
  const naTela = (caminho: string) =>
    page.waitForURL((u: URL) => u.pathname === caminho, { timeout: 15_000 }).then(() => true, () => false);
  /** Entra pela tela de login; `esperar: false` quando o login deve falhar. */
  const entrar = async (e: string, senha = SENHA, { esperar = true } = {}) => {
    await page.goto(`${front}/login`);
    await page.fill('#email', e);
    await page.fill('#password', senha);
    await page.click('button[type=submit]');
    if (esperar) await page.waitForURL((u: URL) => u.pathname !== '/login', { timeout: 15_000 }).catch(() => {});
  };
  const sair = async () => {
    await page.getByRole('button', { name: /sair/i }).first().click();
    await naTela('/login');
  };
  /** Login direto na API (para preparar dados do teste). */
  const tokenDe = async (e: string, senha = SENHA) =>
    ((await (
      await fetch(`${api}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, senha }),
      })
    ).json()) as { token: string }).token;
  const chamar = async (metodo: string, caminho: string, token: string, body?: unknown) => {
    const res = await fetch(api + caminho, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const texto = await res.text();
    return { status: res.status, json: texto ? JSON.parse(texto) : null };
  };

  return { api, front, page, prisma, pastaArquivos, email, criarUsuario, visivel, naTela, entrar, sair, tokenDe, chamar, fechar };
}
