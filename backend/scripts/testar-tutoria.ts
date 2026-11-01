/**
 * Conferência da Fase 5, Parte 6: tutoria (tutorados, check-ins, registros, combinados, foto e
 * documentos), com o padrão A sobre o tutorado. Usa uma pasta temporária como armazenamento, cria
 * usuários de teste (e-mails `teste-tutoria-*`), turmas e alunos, testa via HTTP e apaga tudo.
 *
 * Uso: npm run test:tutoria
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

const PREFIXO = `teste-tutoria-${Date.now()}`;
const SENHA = 'SenhaDeTeste123';
const email = (nome: string) => `${PREFIXO}-${nome}@prof.educacao.sp.gov.br`;
const INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from('foto')]);
const PDF = Buffer.from('%PDF-1.4\nplano\n%%EOF');

type Tutorado = { id: string; user_id: string; aluno_id: string | null; nome: string; turma: string | null; numero_chamada: number | null; status: string; foto_path: string | null; data_inicio: string };

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), 'painel-tutoria-'));
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
    const turma = (await call('POST', '/turmas', { token: tA, body: { nome: `${PREFIXO} 1A`, serie: '1º Ano EM' } })).json;
    const [a1, a2, a3] = await Promise.all(
      ['Ana', 'Bruno', 'Carla'].map(async (nome, i) => (await call('POST', '/alunos', { token: tA, body: { nome, turma_id: turma.id, numero_chamada: i + 1 } })).json),
    );

    console.log('\n— Tutorados —');
    const vinc = await call('POST', '/tutorados/vincular', { token: tA, body: { aluno_ids: [a1.id, a2.id] } });
    const t1 = vinc.json?.criados?.find((t: Tutorado) => t.aluno_id === a1.id) as Tutorado;
    check(vinc.status === 201 && vinc.json.criados.length === 2 && vinc.json.ja_existiam === 0, 'Professor vincula dois alunos de uma vez');
    check(t1.nome === 'Ana' && t1.turma === `${PREFIXO} 1A` && t1.numero_chamada === 1 && t1.status === 'ativo' && t1.user_id === profA.id, 'Nome, turma e número vêm do cadastro do aluno');
    const de_novo = await call('POST', '/tutorados/vincular', { token: tA, body: { aluno_ids: [a1.id, a3.id] } });
    check(de_novo.json?.criados?.length === 1 && de_novo.json.ja_existiam === 1, 'Vincular de novo não duplica (só o novo entra)');
    check(codigo(await call('POST', '/tutorados/vincular', { token: tA, body: { aluno_ids: [INEXISTENTE] } })) === 'ALUNO_INVALIDO', 'Aluno inexistente → aluno inválido');
    check(codigo(await call('POST', '/tutorados', { token: tA, body: { nome: 'Ana', aluno_id: a1.id } })) === 'TUTORADO_DUPLICADO', 'Cadastrar o mesmo aluno outra vez → duplicado');
    const avulso = await call('POST', '/tutorados', { token: tA, body: { nome: 'Diego (transferido)', turma: '1ºB', status: 'inativo' } });
    check(avulso.status === 201 && avulso.json.aluno_id === null && avulso.json.status === 'inativo', 'Tutorado sem cadastro de aluno, inativo');
    check(codigo(await call('POST', '/tutorados', { token: tA, body: { nome: 'X', status: 'pausado' } })) === 'DADOS_INVALIDOS', 'Situação inventada → erro de dados');
    check((await call('POST', '/tutorados/vincular', { token: tB, body: { aluno_ids: [a1.id] } })).json?.criados?.length === 1, 'Outro professor pode ser tutor do mesmo aluno');
    check((await call('GET', '/tutorados', { token: tA })).json.length === 4 && (await call('GET', '/tutorados?status=ativo', { token: tA })).json.length === 3, 'Lista os próprios tutorados, e por situação');
    check((await call('GET', `/tutorados?user_id=${profA.id}`, { token: tCoord })).json.length === 4, 'Gestão vê os tutorados de um professor');
    check(codigo(await call('GET', `/tutorados/${t1.id}`, { token: tB })) === 'TUTORADO_NAO_ENCONTRADO', 'Professor B não abre o tutorado do A');
    check((await call('PATCH', `/tutorados/${t1.id}`, { token: tA, body: { observacoes: 'Gosta de música' } })).json?.observacoes === 'Gosta de música', 'Tutor altera');
    check(codigo(await call('PATCH', `/tutorados/${t1.id}`, { token: tCoord, body: { observacoes: 'X' } })) === 'SEM_PERMISSAO', 'Gestão não altera');

    console.log('\n— Acompanhamento —');
    const add = (item: string, body: object, t = tA) => call('POST', `/tutorados/${t1.id}/${item}`, { token: t, body });
    const ck = await add('checkins', { humor: 'bem', observacao: 'Sorridente' });
    check(ck.status === 201 && ck.json.humor === 'bem' && ck.json.user_id === profA.id, 'Check-in de humor');
    check(codigo(await add('checkins', { humor: 'feliz' })) === 'DADOS_INVALIDOS', 'Humor inventado → erro de dados');
    const reg = await add('registros', { como_esta: 'Motivado', proxima_acao: 'Conversar com a família', data: '2026-10-15' });
    check(reg.status === 201 && reg.json.data === '2026-10-15' && reg.json.como_esta === 'Motivado', 'Registro do encontro');
    check(codigo(await add('registros', { observacao: 'X' })) === 'DADOS_INVALIDOS', 'Registro sem "como está" → erro de dados');
    const comb = await add('combinados', { descricao: 'Entregar as tarefas em dia' }, tAdmin);
    check(comb.status === 201 && comb.json.status === 'pendente' && comb.json.user_id === profA.id, 'Combinado (pelo admin, fica no nome do tutor), pendente');
    const cumprido = await call('PATCH', `/tutorados/${t1.id}/combinados/${comb.json.id}`, { token: tA, body: { status: 'concluido' } });
    check(cumprido.json?.status === 'concluido', 'Marca o combinado como cumprido');
    check(codigo(await call('PATCH', `/tutorados/${t1.id}/combinados/${INEXISTENTE}`, { token: tA, body: { status: 'concluido' } })) === 'ITEM_NAO_ENCONTRADO', 'Combinado inexistente → não encontrado');
    check(codigo(await add('checkins', { humor: 'bem' }, tCoord)) === 'SEM_PERMISSAO', 'Gestão não registra');
    check(codigo(await add('checkins', { humor: 'bem' }, tB)) === 'TUTORADO_NAO_ENCONTRADO', 'Professor B não registra');
    const regs = (await call('GET', `/tutoria-registros?tutorado_id=${t1.id}`, { token: tCoord })).json;
    check(regs.length === 1 && regs[0].data === '2026-10-15', 'Registros de vários tutorados de uma vez (gestão vê)');

    console.log('\n— Foto e documentos —');
    const foto = await call('PUT', `/tutorados/${t1.id}/foto?nome=ana.png`, { token: tA, body: PNG, tipo: 'image/png' });
    check(foto.status === 200 && foto.json.foto_path?.startsWith(`${profA.id}/${t1.id}/`) && noDisco('tutoria-fotos', foto.json.foto_path), 'Coloca a foto do tutorado (na pasta do tutor)');
    const foto2 = await call('PUT', `/tutorados/${t1.id}/foto?nome=ana2.png`, { token: tA, body: PNG, tipo: 'image/png' });
    check(foto2.json?.foto_path !== foto.json.foto_path && !noDisco('tutoria-fotos', foto.json.foto_path), 'Trocar a foto apaga a anterior');
    check(codigo(await call('PUT', `/tutorados/${t1.id}/foto`, { token: tA, body: PDF, tipo: 'application/pdf' })) === 'TIPO_NAO_PERMITIDO', 'PDF como foto → tipo não permitido');
    const doc = await call('POST', `/tutorados/${t1.id}/documentos?nome=${encodeURIComponent('Plano de estudos.pdf')}`, { token: tA, body: PDF, tipo: 'application/pdf' });
    check(doc.status === 201 && doc.json.nome_arquivo === 'Plano de estudos.pdf' && doc.json.tamanho_bytes === PDF.length, 'Anexa um documento');
    const detalhe = (await call('GET', `/tutorados/${t1.id}`, { token: tCoord })).json;
    check(detalhe.checkins.length === 1 && detalhe.registros.length === 1 && detalhe.combinados.length === 1 && detalhe.documentos.length === 1, 'O tutorado vem com todo o acompanhamento (gestão vê)');
    check((await call('DELETE', `/tutorados/${t1.id}/checkins/${ck.json.id}`, { token: tA })).status === 204, 'Apaga um check-in');
    check(codigo(await call('DELETE', `/tutorados/${t1.id}/registros/${reg.json.id}`, { token: tCoord })) === 'SEM_PERMISSAO', 'Gestão não apaga');
    check((await call('DELETE', `/tutorados/${t1.id}/documentos/${doc.json.id}`, { token: tA })).status === 204 && !noDisco('tutoria-documentos', doc.json.storage_path), 'Apaga o documento (banco e armazenamento)');
    check((await call('DELETE', `/tutorados/${t1.id}/foto`, { token: tA })).json?.foto_path === null && !noDisco('tutoria-fotos', foto2.json.foto_path), 'Remove a foto');
    const doc2 = await call('POST', `/tutorados/${t1.id}/documentos?nome=x.pdf`, { token: tA, body: PDF, tipo: 'application/pdf' });
    const foto3 = await call('PUT', `/tutorados/${t1.id}/foto`, { token: tA, body: PNG, tipo: 'image/png' });
    check((await call('DELETE', `/tutorados/${t1.id}`, { token: tCoord })).status === 403, 'Gestão não exclui o tutorado');
    check((await call('DELETE', `/tutorados/${t1.id}`, { token: tA })).status === 204, 'Tutor exclui o tutorado');
    check(
      !noDisco('tutoria-documentos', doc2.json.storage_path) && !noDisco('tutoria-fotos', foto3.json.foto_path) &&
        (await prisma.tutoria_registros.count({ where: { tutorado_id: t1.id } })) === 0,
      'Excluir leva o acompanhamento, a foto e os documentos',
    );
  } finally {
    server.close();
    const turmas = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    await rm(dir, { recursive: true, force: true });
    console.log(`\n🧹 ${turmas.count} turmas, ${count} usuários de teste (com a tutoria) e a pasta temporária apagados.`);
    await prisma.$disconnect();
  }

  console.log(falhas === 0 ? '\nTudo certo ✅' : `\n${falhas} falha(s) ❌`);
  if (falhas) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
