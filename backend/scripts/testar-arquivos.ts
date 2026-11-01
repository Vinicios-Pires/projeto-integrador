/**
 * Conferência da Fase 3, Parte 1: "correio de arquivos" (enviar, link temporário, excluir)
 * e as regras de quem pode (o dono envia e exclui; a gestão vê; o admin exclui; o mural de
 * replicabilidade é aberto a todos). Usa o armazenamento local numa pasta temporária, cria
 * usuários de teste (e-mails `teste-arquivos-*`), testa via HTTP e apaga tudo ao final.
 *
 * Uso: npm run test:arquivos
 */
import 'dotenv/config';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { app_role } from '@prisma/client';

let falhas = 0;
function check(ok: boolean, descricao: string) {
  console.log(`${ok ? '✅' : '❌'} ${descricao}`);
  if (!ok) falhas++;
}

const PREFIXO = `teste-arquivos-${Date.now()}`;
const SENHA = 'SenhaDeTeste123';
const email = (nome: string) => `${PREFIXO}-${nome}@prof.educacao.sp.gov.br`;
const PASTA = '11111111-2222-4333-8444-555555555555';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('imagem de teste')]);
const MB = 1024 * 1024;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // O armazenamento é escolhido ao carregar a API: a pasta temporária vem antes.
  const dir = await mkdtemp(path.join(tmpdir(), 'painel-arquivos-'));
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
    try { json = text ? JSON.parse(text) : null; } catch { /* conteúdo binário */ }
    return { status: res.status, headers: res.headers, bytes, json };
  }
  const token = async (nome: string) =>
    (await call('POST', '/auth/login', { body: { email: email(nome), senha: SENHA } })).json.token as string;
  const codigo = (r: { json: { error?: { code: string } } | null }) => r.json?.error?.code;

  try {
    await criarUsuario('admin', 'admin');
    await criarUsuario('coord', 'coordenador');
    const profA = await criarUsuario('profa', 'professor');
    await criarUsuario('profb', 'professor');
    const tAdmin = await token('admin');
    const tCoord = await token('coord');
    const tA = await token('profa');
    const tB = await token('profb');

    const enviar = (bucket: string, conteudo: Buffer, { t = tA, tipo = 'image/png', pasta = PASTA, nome = 'foto.png' } = {}) =>
      call('POST', `/files/${bucket}?pasta=${encodeURIComponent(pasta)}&nome=${encodeURIComponent(nome)}`, { token: t, body: conteudo, tipo });
    const link = (bucket: string, p: string, t = tA, extra = '') => call('GET', `/files/${bucket}/url?path=${encodeURIComponent(p)}${extra}`, { token: t });
    const noDisco = (bucket: string, p: string) => existsSync(path.join(dir, bucket, p));

    console.log('\n— Enviar —');
    const f1 = await enviar('ocorrencias-fotos', PNG, { nome: 'Foto da Ação 1.png' });
    check(f1.status === 201 && f1.json.path.startsWith(`${profA.id}/${PASTA}/`), 'Professor envia foto; ela vai para a pasta dele e do registro');
    check(f1.json?.path.endsWith('-Foto_da_Acao_1.png') && f1.json?.nome === 'Foto da Ação 1.png', 'Nome seguro no caminho, nome original na resposta');
    check(f1.json?.mime_type === 'image/png' && f1.json?.tamanho_bytes === PNG.length, 'Resposta traz tipo e tamanho (o que as tabelas guardam)');
    check(noDisco('ocorrencias-fotos', f1.json.path), 'O arquivo foi guardado');
    const f2 = await enviar('ocorrencias-fotos', PNG);
    check(f2.status === 201 && f2.json.path !== f1.json.path, 'Dois envios nunca usam o mesmo caminho');
    const fuga = await enviar('ocorrencias-fotos', PNG, { nome: '../../../segredo.png' });
    check(fuga.status === 201 && fuga.json.path.startsWith(`${profA.id}/${PASTA}/`) && !fuga.json.path.includes('..'), 'Nome com "../" não sai da pasta');
    check(codigo(await enviar('ocorrencias-fotos', PNG, { tipo: 'text/html' })) === 'TIPO_NAO_PERMITIDO', 'Página da web disfarçada → tipo não permitido');
    check(codigo(await enviar('ocorrencias-fotos', PNG, { tipo: 'application/pdf' })) === 'TIPO_NAO_PERMITIDO', 'PDF no lugar de foto → tipo não permitido');
    check(codigo(await enviar('pdi-documentos', PNG)) === 'TIPO_NAO_PERMITIDO', 'Foto no lugar de documento do PDI → tipo não permitido');
    const pdf = await enviar('pdi-documentos', Buffer.from('%PDF-1.4 teste'), { tipo: 'application/pdf', nome: 'relatório.pdf' });
    check(pdf.status === 201, 'Documento PDF no bucket de documentos');
    check(codigo(await enviar('ocorrencias-fotos', Buffer.alloc(0))) === 'ARQUIVO_VAZIO', 'Arquivo vazio → recusado');
    const grande = await enviar('ocorrencias-fotos', Buffer.alloc(10 * MB + 1));
    check(grande.status === 413 && codigo(grande) === 'ARQUIVO_GRANDE_DEMAIS', 'Foto acima de 10 MB → grande demais');
    const anexo = await enviar('plano-anexos', Buffer.alloc(11 * MB, 1), { tipo: 'application/pdf', nome: 'plano.pdf' });
    check(anexo.status === 201, 'Anexo de plano de 11 MB passa (limite dos documentos é 20 MB)');
    check(codigo(await enviar('ocorrencias-fotos', PNG, { pasta: '../x' })) === 'DADOS_INVALIDOS', 'Pasta com "../" → erro de dados');
    check(codigo(await call('POST', '/files/ocorrencias-fotos?nome=a.png', { token: tA, body: PNG, tipo: 'image/png' })) === 'DADOS_INVALIDOS', 'Sem pasta → erro de dados');
    check(codigo(await enviar('fotos-secretas', PNG)) === 'BUCKET_NAO_ENCONTRADO', 'Bucket inexistente → não encontrado');
    check(codigo(await enviar('__proto__', PNG)) === 'BUCKET_NAO_ENCONTRADO', 'Bucket com nome "especial" → não encontrado (sem erro interno)');
    const semLogin = await call('POST', `/files/ocorrencias-fotos?pasta=${PASTA}&nome=x.png`, { body: PNG, tipo: 'image/png' });
    check(semLogin.status === 401, 'Sem login não envia');

    console.log('\n— Links temporários —');
    const l1 = await link('ocorrencias-fotos', f1.json.path);
    check(l1.status === 200 && typeof l1.json.url === 'string' && !!Date.parse(l1.json.expira_em), 'Dono pede um link temporário');
    const aberto = await call('GET', l1.json.url);
    check(aberto.status === 200 && aberto.bytes.equals(PNG), 'O link abre o arquivo sem login (como a URL assinada do Supabase)');
    check(aberto.headers.get('content-type') === 'image/png' && aberto.headers.get('x-content-type-options') === 'nosniff', 'Com o tipo certo e sem o navegador "adivinhar"');
    check(aberto.headers.get('content-disposition') === 'inline', 'Abre na tela (não baixa) por padrão');
    const paraBaixar = await call('GET', (await link('pdi-documentos', pdf.json.path, tA, `&download=${encodeURIComponent('relatório.pdf')}`)).json.url);
    check(paraBaixar.headers.get('content-disposition') === `attachment; filename*=UTF-8''${encodeURIComponent('relatório.pdf')}`, 'Com "download", baixa com o nome original');
    check(codigo(await link('ocorrencias-fotos', f1.json.path, tB)) === 'ARQUIVO_NAO_ENCONTRADO', 'Professor B não abre a foto do A (como se não existisse)');
    check((await link('ocorrencias-fotos', f1.json.path, tCoord)).status === 200, 'Gestão abre a foto de qualquer professor');
    const mural = await enviar('replicabilidade-fotos', PNG);
    check((await link('replicabilidade-fotos', mural.json.path, tB)).status === 200, 'Mural de replicabilidade: qualquer professor abre');
    check(codigo(await link('ocorrencias-fotos', `${profA.id}/${PASTA}/nao-existe.png`)) === 'ARQUIVO_NAO_ENCONTRADO', 'Arquivo inexistente → não encontrado');
    for (const ruim of ['../x', 'abc/def', profA.id, `${profA.id}/../../x`, `${profA.id}//x`]) {
      check(codigo(await link('ocorrencias-fotos', ruim)) === 'DADOS_INVALIDOS', `Caminho inválido "${ruim.replace(profA.id, '<dono>')}" → erro de dados`);
    }
    check(codigo(await link('ocorrencias-fotos', f1.json.path, tA, '&segundos=5')) === 'DADOS_INVALIDOS', 'Validade fora do limite → erro de dados');
    const adulterado = l1.json.url.slice(0, -3) + (l1.json.url.endsWith('aaa') ? 'bbb' : 'aaa');
    check((await call('GET', adulterado)).status === 404, 'Link adulterado não abre');
    check((await call('GET', `/files/ocorrencias-fotos/url?path=${f1.json.path}`)).status === 401, 'Sem login não pede link');
    const curto = await link('ocorrencias-fotos', f2.json.path, tA, '&segundos=10');
    await esperar(11_000);
    check((await call('GET', curto.json.url)).status === 404, 'Link vencido não abre mais');

    console.log('\n— Vários links de uma vez —');
    const lote = await call('POST', '/files/ocorrencias-fotos/urls', {
      token: tA, body: { paths: [f1.json.path, f2.json.path, `${profA.id}/${PASTA}/sumiu.png`], segundos: 300 },
    });
    check(lote.status === 200 && lote.json.length === 3 && lote.json[0].url && lote.json[1].url, 'Gera links para vários arquivos');
    check(lote.json?.[2]?.url === null, 'Arquivo que não existe volta sem link (os outros saem normalmente)');
    const misturado = await call('POST', '/files/ocorrencias-fotos/urls', { token: tB, body: { paths: [f1.json.path] } });
    check(codigo(misturado) === 'ARQUIVO_NAO_ENCONTRADO', 'Se algum arquivo não é de quem pede, nenhum link sai');
    check(codigo(await call('POST', '/files/ocorrencias-fotos/urls', { token: tA, body: { paths: [] } })) === 'DADOS_INVALIDOS', 'Lista vazia → erro de dados');
    check(codigo(await call('POST', '/files/ocorrencias-fotos/urls', { token: tA, body: { paths: Array(201).fill(f1.json.path).map((p, i) => `${p}${i}`) } })) === 'DADOS_INVALIDOS', 'Mais de 200 → erro de dados');

    console.log('\n— Excluir —');
    const excluir = (bucket: string, p: string, t = tA) => call('DELETE', `/files/${bucket}?path=${encodeURIComponent(p)}`, { token: t });
    check(codigo(await excluir('ocorrencias-fotos', f1.json.path, tCoord)) === 'SEM_PERMISSAO', 'Gestão vê, mas não exclui');
    check(codigo(await excluir('ocorrencias-fotos', f1.json.path, tB)) === 'ARQUIVO_NAO_ENCONTRADO', 'Professor B não exclui a foto do A');
    check(noDisco('ocorrencias-fotos', f1.json.path), 'A foto continua lá');
    check((await excluir('ocorrencias-fotos', f1.json.path)).status === 204, 'Dono exclui');
    check(!noDisco('ocorrencias-fotos', f1.json.path), 'O arquivo saiu do armazenamento');
    check((await call('GET', l1.json.url)).status === 404, 'Link antigo para de abrir');
    check(codigo(await excluir('ocorrencias-fotos', f1.json.path)) === 'ARQUIVO_NAO_ENCONTRADO', 'Excluir de novo → não encontrado');
    const fotoB = await enviar('tutoria-fotos', PNG, { t: tB });
    check((await excluir('tutoria-fotos', fotoB.json.path, tAdmin)).status === 204, 'Admin exclui arquivo de qualquer professor');

    const varios = await call('POST', '/files/ocorrencias-fotos/excluir', { token: tA, body: { paths: [f2.json.path, fuga.json.path] } });
    check(varios.status === 200 && varios.json.excluidos.length === 2, 'Exclui vários de uma vez');
    const minha = await enviar('ocorrencias-fotos', PNG);
    const outroB = await enviar('ocorrencias-fotos', PNG, { t: tB });
    const bloqueado = await call('POST', '/files/ocorrencias-fotos/excluir', { token: tA, body: { paths: [minha.json.path, outroB.json.path] } });
    check(
      codigo(bloqueado) === 'ARQUIVO_NAO_ENCONTRADO' && noDisco('ocorrencias-fotos', minha.json.path) && noDisco('ocorrencias-fotos', outroB.json.path),
      'Se algum não é de quem pede, nenhum sai',
    );
  } finally {
    server.close();
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    await rm(dir, { recursive: true, force: true });
    console.log(`\n🧹 ${count} usuários de teste e a pasta temporária de arquivos apagados.`);
    await prisma.$disconnect();
  }

  console.log(falhas === 0 ? '\nTudo certo ✅' : `\n${falhas} falha(s) ❌`);
  if (falhas) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
