/**
 * Conferência da Fase 3, Parte 2: o correio de arquivos ligado ao Supabase Storage
 * (`STORAGE_DRIVER=supabase`). Como a chave real ainda não foi entregue, sobe um "Supabase
 * de mentira" que imita a API REST do Storage (enviar, assinar links, baixar, excluir) e
 * anota cada pedido, para conferir o que o backend manda. Cria usuários de teste
 * (e-mails `teste-supa-*`) e apaga tudo ao final.
 *
 * Uso: npm run test:supabase-storage
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { app_role } from '@prisma/client';

let falhas = 0;
function check(ok: boolean, descricao: string) {
  console.log(`${ok ? '✅' : '❌'} ${descricao}`);
  if (!ok) falhas++;
}

const PREFIXO = `teste-supa-${Date.now()}`;
const SENHA = 'SenhaDeTeste123';
const email = (nome: string) => `${PREFIXO}-${nome}@prof.educacao.sp.gov.br`;
const CHAVE = `chave-servico-${randomBytes(16).toString('hex')}`;
const PNG = Buffer.from('\x89PNG imagem de teste', 'binary');

// ===== Supabase de mentira =====

interface Pedido { metodo: string; rota: string; headers: IncomingMessage['headers']; corpo: Buffer }
const pedidos: Pedido[] = [];
const objetos = new Map<string, { conteudo: Buffer; mime: string }>();
const TOKEN = 'token-assinado';

const lerCorpo = (req: IncomingMessage) =>
  new Promise<Buffer>((resolve) => {
    const partes: Buffer[] = [];
    req.on('data', (p) => partes.push(p));
    req.on('end', () => resolve(Buffer.concat(partes)));
  });

const supabase = createServer(async (req, res) => {
  const url = new URL(req.url!, 'http://x');
  const corpo = await lerCorpo(req);
  pedidos.push({ metodo: req.method!, rota: url.pathname, headers: req.headers, corpo });
  const json = (status: number, dados: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(dados));
  };
  const autorizado = req.headers.apikey === CHAVE && req.headers.authorization === `Bearer ${CHAVE}`;
  const rota = url.pathname.replace(/^\/storage\/v1/, '');

  // Abrir um link assinado (não pede a chave: é o que o navegador acessa).
  let m = rota.match(/^\/object\/sign\/([^/]+)\/(.+)$/);
  if (req.method === 'GET' && m) {
    const objeto = objetos.get(`${m[1]}/${decodeURIComponent(m[2])}`);
    if (url.searchParams.get('token') !== TOKEN || !objeto) return json(400, { error: 'Object not found' });
    const download = url.searchParams.get('download');
    res.writeHead(200, { 'Content-Type': objeto.mime, ...(download ? { 'Content-Disposition': `attachment; filename="${download}"` } : {}) });
    return res.end(objeto.conteudo);
  }
  if (!autorizado) return json(403, { error: 'Unauthorized' });

  m = rota.match(/^\/object\/sign\/([^/]+)$/);
  if (req.method === 'POST' && m) {
    const { paths } = JSON.parse(corpo.toString()) as { paths: string[] };
    return json(200, paths.map((p) =>
      objetos.has(`${m![1]}/${p}`)
        ? { path: p, signedURL: `/object/sign/${m![1]}/${p.split('/').map(encodeURIComponent).join('/')}?token=${TOKEN}`, error: null }
        : { path: p, signedURL: null, error: 'Object not found' },
    ));
  }
  m = rota.match(/^\/object\/([^/]+)$/);
  if (req.method === 'DELETE' && m) {
    const { prefixes } = JSON.parse(corpo.toString()) as { prefixes: string[] };
    const apagados = prefixes.filter((p) => objetos.delete(`${m![1]}/${p}`));
    return json(200, apagados.map((name) => ({ name, bucket_id: m![1] })));
  }
  m = rota.match(/^\/object\/([^/]+)\/(.+)$/);
  if (req.method === 'POST' && m) {
    const chave = `${m[1]}/${decodeURIComponent(m[2])}`;
    if (chave.includes('falhar')) return json(500, { error: `erro interno do storage ${CHAVE}` });
    if (objetos.has(chave) && req.headers['x-upsert'] !== 'true') return json(409, { error: 'Duplicate' });
    objetos.set(chave, { conteudo: corpo, mime: String(req.headers['content-type']) });
    return json(200, { Key: chave });
  }
  json(404, { error: 'not found' });
});

async function main() {
  supabase.listen(0);
  process.env.STORAGE_DRIVER = 'supabase';
  process.env.SUPABASE_URL = `http://localhost:${(supabase.address() as AddressInfo).port}/`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE;
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

  // Guarda o que o servidor escreve no log de erros, para conferir que a chave não aparece.
  const logs: string[] = [];
  const consoleError = console.error;
  console.error = (...args: unknown[]) => logs.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));

  const server = app.listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  const respostas: string[] = [];

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
    if (!url.startsWith('http')) respostas.push(bytes.toString('utf8') + JSON.stringify([...res.headers]));
    let json = null;
    try { json = bytes.length ? JSON.parse(bytes.toString('utf8')) : null; } catch { /* binário */ }
    return { status: res.status, headers: res.headers, bytes, json };
  }
  const token = async (nome: string) =>
    (await call('POST', '/auth/login', { body: { email: email(nome), senha: SENHA } })).json.token as string;
  const codigo = (r: { json: { error?: { code: string } } | null }) => r.json?.error?.code;

  try {
    await criarUsuario('admin', 'admin');
    const profA = await criarUsuario('profa', 'professor');
    await criarUsuario('profb', 'professor');
    const tAdmin = await token('admin');
    const tA = await token('profa');
    const tB = await token('profb');
    const pasta = '11111111-2222-4333-8444-555555555555';
    const enviar = (nome: string, t = tA) =>
      call('POST', `/files/ocorrencias-fotos?pasta=${pasta}&nome=${encodeURIComponent(nome)}`, { token: t, body: PNG, tipo: 'image/png' });

    console.log('\n— Enviar —');
    const f1 = await enviar('foto 1.png');
    const envio = pedidos.at(-1)!;
    check(f1.status === 201 && objetos.has(`ocorrencias-fotos/${f1.json.path}`), 'O arquivo chega ao Supabase, no bucket e caminho certos');
    check(envio.headers.apikey === CHAVE && envio.headers.authorization === `Bearer ${CHAVE}`, 'O backend se identifica com a chave de serviço');
    check(envio.headers['content-type'] === 'image/png' && envio.headers['x-upsert'] === 'false', 'Manda o tipo do arquivo e nunca sobrescreve um existente');
    check(objetos.get(`ocorrencias-fotos/${f1.json.path}`)?.conteudo.equals(PNG) === true, 'O conteúdo chega intacto');
    const antes = pedidos.length;
    check(codigo(await call('POST', `/files/ocorrencias-fotos?pasta=${pasta}&nome=x.png`, { body: PNG, tipo: 'image/png' })) === 'NAO_AUTENTICADO', 'Sem login, nada é enviado...');
    check(codigo(await call('POST', `/files/ocorrencias-fotos?pasta=${pasta}&nome=x.png`, { token: tA, body: PNG, tipo: 'text/html' })) === 'TIPO_NAO_PERMITIDO', '...nem tipo recusado...');
    check(pedidos.length === antes, '...e o Supabase nem é chamado nesses casos');
    const quebra = await enviar('falhar.png');
    check(quebra.status === 500 && codigo(quebra) === 'ERRO_INTERNO', 'Se o Supabase falha, a pessoa recebe um erro genérico');
    check(!logs.some((l) => l.includes(CHAVE)) && logs.some((l) => l.includes('***')), 'E a chave sai mascarada no log do servidor');

    console.log('\n— Links —');
    const l1 = await call('GET', `/files/ocorrencias-fotos/url?path=${encodeURIComponent(f1.json.path)}&segundos=120`, { token: tA });
    check(l1.status === 200 && l1.json.url.startsWith(process.env.SUPABASE_URL!.replace(/\/$/, '') + '/storage/v1/object/sign/'), 'O link aponta para o Supabase (o arquivo não passa pelo backend)');
    check(JSON.parse(pedidos.at(-1)!.corpo.toString()).expiresIn === 120, 'Pede ao Supabase a validade escolhida');
    const aberto = await call('GET', l1.json.url);
    check(aberto.status === 200 && aberto.bytes.equals(PNG), 'O link abre o arquivo');
    const baixar = await call('GET', `/files/ocorrencias-fotos/url?path=${encodeURIComponent(f1.json.path)}&download=${encodeURIComponent('foto 1.png')}`, { token: tA });
    check(new URL(baixar.json.url).searchParams.get('download') === 'foto 1.png', 'Link "para baixar" leva o nome original');
    check((await call('GET', baixar.json.url)).headers.get('content-disposition')?.startsWith('attachment') === true, 'E o Supabase entrega como download');

    // Arquivo antigo, enviado pela tela atual, com espaço e acento no nome.
    const antigo = `${profA.id}/${pasta}/1700000000000_Plano de Aula — ção.pdf`;
    objetos.set(`ocorrencias-fotos/${antigo}`, { conteudo: Buffer.from('antigo'), mime: 'application/pdf' });
    const lAntigo = await call('GET', `/files/ocorrencias-fotos/url?path=${encodeURIComponent(antigo)}`, { token: tA });
    check(lAntigo.status === 200 && (await call('GET', lAntigo.json.url)).bytes.toString() === 'antigo', 'Arquivos antigos com espaço e acento no nome continuam abrindo');

    const f2 = await enviar('foto 2.png');
    const assinaturasAntes = pedidos.filter((p) => p.rota.endsWith('/object/sign/ocorrencias-fotos')).length;
    const lote = await call('POST', '/files/ocorrencias-fotos/urls', { token: tA, body: { paths: [f1.json.path, f2.json.path, `${profA.id}/${pasta}/sumiu.png`] } });
    const assinaturas = pedidos.filter((p) => p.rota.endsWith('/object/sign/ocorrencias-fotos'));
    check(lote.status === 200 && lote.json[0].url && lote.json[1].url && lote.json[2].url === null, 'Vários links: os que existem saem, o que sumiu volta sem link');
    check(assinaturas.length === assinaturasAntes + 1 && JSON.parse(assinaturas.at(-1)!.corpo.toString()).paths.length === 3, 'Tudo numa única ida ao Supabase');
    const antesB = pedidos.length;
    check(codigo(await call('GET', `/files/ocorrencias-fotos/url?path=${encodeURIComponent(f1.json.path)}`, { token: tB })) === 'ARQUIVO_NAO_ENCONTRADO', 'Professor B não recebe link da foto do A...');
    check(pedidos.length === antesB, '...e o Supabase nem é consultado');
    check(codigo(await call('GET', `/files/ocorrencias-fotos/url?path=${encodeURIComponent(`${profA.id}/${pasta}/sumiu.png`)}`, { token: tA })) === 'ARQUIVO_NAO_ENCONTRADO', 'Arquivo que não existe no Supabase → não encontrado');
    check((await call('GET', '/files/link/qualquer')).status === 404, 'Com o Supabase, a rota de link local não existe');

    console.log('\n— Excluir —');
    const ex = await call('DELETE', `/files/ocorrencias-fotos?path=${encodeURIComponent(f1.json.path)}`, { token: tA });
    check(ex.status === 204 && !objetos.has(`ocorrencias-fotos/${f1.json.path}`), 'Dono exclui; o arquivo sai do Supabase');
    check(codigo(await call('DELETE', `/files/ocorrencias-fotos?path=${encodeURIComponent(f1.json.path)}`, { token: tA })) === 'ARQUIVO_NAO_ENCONTRADO', 'Excluir de novo → não encontrado');
    const fB = await enviar('foto b.png', tB);
    check((await call('DELETE', `/files/ocorrencias-fotos?path=${encodeURIComponent(fB.json.path)}`, { token: tAdmin })).status === 204, 'Admin exclui arquivo de outro professor');
    const varios = await call('POST', '/files/ocorrencias-fotos/excluir', { token: tA, body: { paths: [f2.json.path, antigo, `${profA.id}/${pasta}/sumiu.png`] } });
    check(varios.status === 200 && varios.json.excluidos.length === 2 && !objetos.has(`ocorrencias-fotos/${antigo}`), 'Exclui vários; informa só os que existiam');

    console.log('\n— A chave nunca vaza —');
    check(respostas.length > 10 && respostas.every((r) => !r.includes(CHAVE)), 'Nenhuma resposta da API contém a chave de serviço (nem a do erro)');
    check([l1, baixar, lAntigo].every((r) => !r.json.url.includes(CHAVE)), 'Nem os links entregues às telas');
  } finally {
    console.error = consoleError;
    server.close();
    supabase.close();
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    console.log(`\n🧹 ${count} usuários de teste apagados (os arquivos ficaram só na memória do Supabase de mentira).`);
    await prisma.$disconnect();
  }

  console.log(falhas === 0 ? '\nTudo certo ✅' : `\n${falhas} falha(s) ❌`);
  if (falhas) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
