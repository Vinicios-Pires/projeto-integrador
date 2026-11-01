/**
 * Conferência da Fase 5, Parte 5: PDI (evidências com fotos e documentos), com o padrão A. Usa uma
 * pasta temporária como armazenamento, cria usuários de teste (e-mails `teste-pdi-*`), turmas e
 * matérias, testa via HTTP e apaga tudo ao final.
 *
 * Uso: npm run test:pdi
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

const PREFIXO = `teste-pdi-${Date.now()}`;
const SENHA = 'SenhaDeTeste123';
const email = (nome: string) => `${PREFIXO}-${nome}@prof.educacao.sp.gov.br`;
const INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from('foto de teste')]);
const PDF = Buffer.from('%PDF-1.4\nrelatorio\n%%EOF');

type Evidencia = {
  id: string; user_id: string; titulo: string; data_realizacao: string; ano_letivo: number; bimestre: number; tipo_atividade: string;
  fotos: { id: string; storage_path: string; url: string; nome: string }[];
  documentos: { id: string; storage_path: string; nome_arquivo: string; tamanho_bytes: number; user_id: string }[];
};

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), 'painel-pdi-'));
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
  const ids: string[] = [];

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
  const noDisco = (bucket: string, p: string) => existsSync(path.join(dir, bucket, p));

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
    const turma = (await call('POST', '/turmas', { token: tA, body: { nome: `${PREFIXO} 7E`, serie: '7º Ano' } })).json;
    const turmaB = (await call('POST', '/turmas', { token: tB, body: { nome: `${PREFIXO} 7F`, serie: '7º Ano' } })).json;
    const mat = (await call('POST', '/disciplinas', { token: tA, body: { nome: `${PREFIXO} Ciências` } })).json;

    console.log('\n— Evidências —');
    const criar = (body: object, t = tA) => call('POST', '/pdi-evidencias', { token: t, body });
    const c1 = await criar({ titulo: 'Horta na escola', turma_id: turma.id, disciplina_id: mat.id, bimestre: 2, tipo_atividade: 'Projeto', data_realizacao: '2026-05-12', objetivo: 'Ciclo das plantas' });
    const e1 = c1.json as Evidencia;
    check(c1.status === 201 && e1.user_id === profA.id && e1.data_realizacao === '2026-05-12' && e1.tipo_atividade === 'Projeto' && e1.bimestre === 2, 'Professor registra uma evidência');
    check(e1.ano_letivo === new Date().getFullYear() && Array.isArray(e1.fotos) && Array.isArray(e1.documentos), 'Ano letivo atual por padrão; vem com fotos e documentos (vazios)');
    const c2 = await criar({ titulo: 'Jogo de frações' });
    check(c2.status === 201 && c2.json.tipo_atividade === 'Outro' && c2.json.bimestre === 1, 'Padrões: tipo "Outro", 1º bimestre');
    check(codigo(await criar({})) === 'DADOS_INVALIDOS', 'Sem título → erro de dados');
    check(codigo(await criar({ titulo: 'X', tipo_atividade: 'Passeio' })) === 'DADOS_INVALIDOS', 'Tipo inventado → erro de dados');
    check(codigo(await criar({ titulo: 'X', bimestre: 5 })) === 'DADOS_INVALIDOS', 'Bimestre 5 → erro de dados');
    check(codigo(await criar({ titulo: 'X', turma_id: turmaB.id })) === 'TURMA_INVALIDA', 'Turma de outro professor → turma inválida');
    const lista = (q = '', t = tA) => call('GET', `/pdi-evidencias${q}`, { token: t });
    check((await lista()).json.length === 2 && (await lista()).json[0].id === c2.json.id, 'Lista as próprias, as mais recentes primeiro (a sem data vale hoje)');
    check((await lista('?bimestre=2&tipo_atividade=Projeto')).json.length === 1, 'Filtra por bimestre e tipo');
    check((await lista('', tB)).json.length === 0, 'Professor B não vê');
    check((await lista(`?user_id=${profA.id}`, tCoord)).json.length === 2, 'Gestão vê e filtra por professor');
    check(codigo(await call('GET', `/pdi-evidencias/${e1.id}`, { token: tB })) === 'EVIDENCIA_NAO_ENCONTRADA', 'Professor B não abre');
    check((await call('PATCH', `/pdi-evidencias/${e1.id}`, { token: tA, body: { resultados: 'Turma engajada' } })).json?.resultados === 'Turma engajada', 'Dono altera');
    check(codigo(await call('PATCH', `/pdi-evidencias/${e1.id}`, { token: tCoord, body: { resultados: 'X' } })) === 'SEM_PERMISSAO', 'Gestão não altera');

    console.log('\n— Fotos e documentos —');
    const enviar = (tipoArq: 'fotos' | 'documentos', id: string, conteudo: Buffer, mime: string, nome: string, t = tA) =>
      call('POST', `/pdi-evidencias/${id}/${tipoArq}?nome=${encodeURIComponent(nome)}`, { token: t, body: conteudo, tipo: mime });
    const f1 = await enviar('fotos', e1.id, PNG, 'image/png', 'Horta 1.png');
    check(f1.status === 201 && f1.json.storage_path.startsWith(`${profA.id}/${e1.id}/`) && f1.json.url === f1.json.storage_path && f1.json.nome === 'Horta 1.png', 'Anexa foto (na pasta do professor; url guarda o caminho, como hoje)');
    const d1 = await enviar('documentos', e1.id, PDF, 'application/pdf', 'Relatório.pdf', tAdmin);
    check(d1.status === 201 && d1.json.user_id === profA.id && d1.json.tamanho_bytes === PDF.length && d1.json.storage_path.startsWith(`${profA.id}/`), 'Admin anexa documento; fica no nome e na pasta do professor');
    check(noDisco('pdi-fotos', f1.json.path ?? f1.json.storage_path) && noDisco('pdi-documentos', d1.json.storage_path), 'Os arquivos foram guardados nos lugares certos');
    const aberta = (await call('GET', `/pdi-evidencias/${e1.id}`, { token: tCoord })).json as Evidencia;
    check(aberta.fotos.length === 1 && aberta.documentos.length === 1 && typeof aberta.documentos[0].tamanho_bytes === 'number', 'A evidência vem com as fotos e os documentos (gestão vê)');
    check(codigo(await enviar('fotos', e1.id, PDF, 'application/pdf', 'x.pdf')) === 'TIPO_NAO_PERMITIDO', 'PDF como foto → tipo não permitido');
    check(codigo(await enviar('documentos', e1.id, PNG, 'image/png', 'x.png')) === 'TIPO_NAO_PERMITIDO', 'Imagem como documento → tipo não permitido');
    check(codigo(await enviar('fotos', e1.id, PNG, 'image/png', 'x.png', tCoord)) === 'SEM_PERMISSAO', 'Gestão não anexa');
    check(codigo(await enviar('fotos', e1.id, PNG, 'image/png', 'x.png', tB)) === 'EVIDENCIA_NAO_ENCONTRADA', 'Professor B não anexa');
    check(codigo(await call('DELETE', `/pdi-evidencias/${e1.id}/fotos/${INEXISTENTE}`, { token: tA })) === 'ARQUIVO_NAO_ENCONTRADO', 'Foto inexistente → não encontrada');
    check((await call('DELETE', `/pdi-evidencias/${e1.id}/fotos/${f1.json.id}`, { token: tA })).status === 204 && !noDisco('pdi-fotos', f1.json.storage_path), 'Dono remove a foto (banco e armazenamento)');
    const f2 = await enviar('fotos', e1.id, PNG, 'image/png', 'Horta 2.png');
    check(codigo(await call('DELETE', `/pdi-evidencias/${e1.id}`, { token: tCoord })) === 'SEM_PERMISSAO', 'Gestão não exclui');
    check((await call('DELETE', `/pdi-evidencias/${e1.id}`, { token: tA })).status === 204, 'Dono exclui a evidência');
    check(!noDisco('pdi-fotos', f2.json.storage_path) && !noDisco('pdi-documentos', d1.json.storage_path), 'Excluir a evidência leva as fotos e os documentos');
  } finally {
    server.close();
    const turmas = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    await rm(dir, { recursive: true, force: true });
    console.log(`\n🧹 ${turmas.count} turmas, ${count} usuários de teste (com as evidências) e a pasta temporária apagados.`);
    await prisma.$disconnect();
  }

  console.log(falhas === 0 ? '\nTudo certo ✅' : `\n${falhas} falha(s) ❌`);
  if (falhas) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
