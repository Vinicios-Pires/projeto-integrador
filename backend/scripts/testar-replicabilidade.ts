/**
 * Conferência da Fase 5, Parte 7: replicabilidade (o mural de boas práticas, padrão D), com fotos.
 * Usa uma pasta temporária como armazenamento, cria usuários de teste (e-mails `teste-replic-*`),
 * testa via HTTP e apaga tudo ao final. Como o mural mostra tudo, as checagens filtram pelos
 * autores do teste.
 *
 * Uso: npm run test:replicabilidade
 */
import 'dotenv/config';
import type { AddressInfo } from 'node:net';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { app_role } from '@prisma/client';

let falhas = 0;
function check(ok: boolean, descricao: string) {
  console.log(`${ok ? '✅' : '❌'} ${descricao}`);
  if (!ok) falhas++;
}

const PREFIXO = `teste-replic-${Date.now()}`;
const SENHA = 'SenhaDeTeste123';
const email = (nome: string) => `${PREFIXO}-${nome}@prof.educacao.sp.gov.br`;
const INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from('foto')]);

type Registro = { id: string; user_id: string; titulo: string; autor: { nome: string | null }; fotos: { id: string; storage_path: string; ordem: number; nome: string }[] };

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), 'painel-replic-'));
  process.env.STORAGE_DRIVER = 'local';
  process.env.STORAGE_LOCAL_DIR = dir;
  const { app } = await import('../src/app');
  const { prisma } = await import('../src/lib/prisma');
  const { hashPassword } = await import('../src/lib/password');

  const criarUsuario = async (nome: string, role: app_role) =>
    prisma.usuarios.create({
      data: {
        email: email(nome),
        senha_hash: await hashPassword(SENHA),
        profile: { create: { nome: `Teste ${nome}`, email: email(nome), status: 'ativo' } },
        user_roles: { create: { role } },
      },
    });

  const server = app.listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;

  async function call(method: string, url: string, { body, token, tipo }: { body?: unknown; token?: string; tipo?: string } = {}) {
    const binario = Buffer.isBuffer(body);
    const res = await fetch(url.startsWith('http') ? url : base + url, {
      method,
      headers: {
        ...(tipo ? { 'Content-Type': tipo } : body !== undefined && !binario ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : binario ? new Uint8Array(body as Buffer) : JSON.stringify(body),
    });
    const bytes = Buffer.from(await res.arrayBuffer());
    const text = bytes.toString('utf8');
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* binário */ }
    return { status: res.status, bytes, json };
  }
  const token = async (nome: string) =>
    (await call('POST', '/auth/login', { body: { email: email(nome), senha: SENHA } })).json.token as string;
  const codigo = (r: { json: { error?: { code: string } } | null }) => r.json?.error?.code;
  const noDisco = (p: string) => existsSync(path.join(dir, 'replicabilidade-fotos', p));

  try {
    await criarUsuario('admin', 'admin');
    await criarUsuario('coord', 'coordenador');
    const profA = await criarUsuario('profa', 'professor');
    await criarUsuario('profb', 'professor');
    const tAdmin = await token('admin');
    const tCoord = await token('coord');
    const tA = await token('profa');
    const tB = await token('profb');

    console.log('\n— Publicações —');
    const pub = await call('POST', '/replicabilidades', { token: tA, body: { titulo: 'Rotação por estações', descricao: 'Funcionou bem no 7º ano' } });
    const r1 = pub.json as Registro;
    check(pub.status === 201 && r1.user_id === profA.id && r1.autor?.nome === 'Teste profa' && r1.fotos.length === 0, 'Professor publica no mural (com o nome de quem publicou)');
    check(codigo(await call('POST', '/replicabilidades', { token: tA, body: { descricao: 'sem título' } })) === 'DADOS_INVALIDOS', 'Sem título → erro de dados');
    check((await call('POST', '/replicabilidades', { token: tCoord, body: { titulo: 'X' } })).status === 403, 'Coordenação vê, mas não publica');
    check((await call('POST', '/replicabilidades', { token: tAdmin, body: { titulo: `${PREFIXO} do admin` } })).status === 201, 'Admin publica');
    check((await call('GET', `/replicabilidades?user_id=${profA.id}`, { token: tB })).json.length === 1, 'Outro professor vê a publicação (mural aberto)');
    check((await call('GET', `/replicabilidades/${r1.id}`, { token: tCoord })).json?.titulo === 'Rotação por estações', 'Gestão abre');
    check(codigo(await call('GET', `/replicabilidades/${INEXISTENTE}`, { token: tA })) === 'REPLICABILIDADE_NAO_ENCONTRADA', 'Inexistente → não encontrada');
    check((await call('GET', '/replicabilidades')).status === 401, 'Sem login não vê');
    check((await call('PATCH', `/replicabilidades/${r1.id}`, { token: tA, body: { titulo: 'Rotação por estações (v2)' } })).json?.titulo === 'Rotação por estações (v2)', 'Quem publicou altera');
    check(codigo(await call('PATCH', `/replicabilidades/${r1.id}`, { token: tB, body: { titulo: 'X' } })) === 'SEM_PERMISSAO', 'Outro professor vê, mas não altera');
    check(codigo(await call('PATCH', `/replicabilidades/${r1.id}`, { token: tCoord, body: { titulo: 'X' } })) === 'SEM_PERMISSAO', 'Gestão não altera');
    check((await call('PATCH', `/replicabilidades/${r1.id}`, { token: tAdmin, body: { descricao: 'Revisado' } })).json?.descricao === 'Revisado', 'Admin altera');

    console.log('\n— Fotos —');
    const foto = (t = tA, mime = 'image/png', nome = 'estacao.png') =>
      call('POST', `/replicabilidades/${r1.id}/fotos?nome=${nome}`, { token: t, body: PNG, tipo: mime });
    const f1 = await foto();
    const f2 = await foto(tA, 'image/png', 'estacao2.png');
    check(f1.status === 201 && f1.json.ordem === 0 && f2.json.ordem === 1 && f1.json.storage_path.startsWith(`${profA.id}/${r1.id}/`), 'Fotos entram em ordem, na pasta de quem publicou');
    const visto = (await call('GET', `/replicabilidades/${r1.id}`, { token: tB })).json as Registro;
    check(visto.fotos.map((f) => f.ordem).join(',') === '0,1', 'A publicação vem com as fotos em ordem');
    const link = await call('GET', `/files/replicabilidade-fotos/url?path=${encodeURIComponent(f1.json.storage_path)}`, { token: tB });
    check(link.status === 200 && (await call('GET', link.json.url)).bytes.equals(PNG), 'Outro professor abre a foto pelo correio de arquivos (mural aberto)');
    check(codigo(await foto(tA, 'application/pdf')) === 'TIPO_NAO_PERMITIDO', 'PDF não é foto → tipo não permitido');
    check(codigo(await foto(tB)) === 'SEM_PERMISSAO', 'Outro professor não anexa');
    check((await call('DELETE', `/replicabilidades/${r1.id}/fotos/${f1.json.id}`, { token: tA })).status === 204 && !noDisco(f1.json.storage_path), 'Quem publicou remove uma foto (banco e armazenamento)');
    check(codigo(await call('DELETE', `/replicabilidades/${r1.id}`, { token: tB })) === 'SEM_PERMISSAO', 'Outro professor não exclui');
    check((await call('DELETE', `/replicabilidades/${r1.id}`, { token: tA })).status === 204 && !noDisco(f2.json.storage_path), 'Excluir a publicação leva as fotos');
  } finally {
    server.close();
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    await rm(dir, { recursive: true, force: true });
    console.log(`\n🧹 ${count} usuários de teste (com as publicações) e a pasta temporária apagados.`);
    await prisma.$disconnect();
  }

  console.log(falhas === 0 ? '\nTudo certo ✅' : `\n${falhas} falha(s) ❌`);
  if (falhas) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
