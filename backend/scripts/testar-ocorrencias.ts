/**
 * Conferência da Fase 5, Parte 4: ocorrências do notebook (padrão A, com fotos pelo correio de
 * arquivos) e ocorrências escolares (o professor registra, a gestão responde). Usa uma pasta
 * temporária como armazenamento, cria usuários de teste (e-mails `teste-ocorr-*`) e turmas, testa
 * via HTTP e apaga tudo ao final.
 *
 * Uso: npm run test:ocorrencias
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

const PREFIXO = `teste-ocorr-${Date.now()}`;
const SENHA = 'SenhaDeTeste123';
const email = (nome: string) => `${PREFIXO}-${nome}@prof.educacao.sp.gov.br`;
const INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('foto de teste')]);
const MB = 1024 * 1024;

type Notebook = { id: string; user_id: string; turma_id: string | null; data_ocorrencia: string; quantidade_notebooks: number; turmas: { nome: string } | null; fotos: { id: string; path: string }[] };
type Escolar = { id: string; user_id: string; status: string; tipo: string; data: string; providencias: string | null; gestao_user_id: string | null; respondido_em: string | null; visto_pelo_professor: boolean };

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), 'painel-ocorrencias-'));
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
    const turma = (await call('POST', '/turmas', { token: tA, body: { nome: `${PREFIXO} 8C`, serie: '8º Ano' } })).json;
    const turmaB = (await call('POST', '/turmas', { token: tB, body: { nome: `${PREFIXO} 8D`, serie: '8º Ano' } })).json;

    console.log('\n— Ocorrências do notebook —');
    const nb = (body: object, t = tA) => call('POST', '/ocorrencias-notebook', { token: t, body });
    const c1 = await nb({ turma_id: turma.id, data_ocorrencia: '2026-10-20', quantidade_notebooks: 30, problema_encontrado: 'Sem internet', internet_funcionou: false });
    const o1 = c1.json as Notebook;
    check(c1.status === 201 && o1.user_id === profA.id && o1.data_ocorrencia === '2026-10-20' && o1.turmas?.nome === `${PREFIXO} 8C` && o1.fotos.length === 0, 'Professor registra a ocorrência, com a turma junto');
    check((await nb({})).json?.data_ocorrencia === new Date().toISOString().slice(0, 10), 'Sem data, vale a de hoje');
    check(codigo(await nb({ turma_id: turmaB.id })) === 'TURMA_INVALIDA', 'Turma de outro professor → turma inválida');
    check(codigo(await nb({ quantidade_notebooks: -1 })) === 'DADOS_INVALIDOS', 'Quantidade negativa → erro de dados');
    check(codigo(await nb({ data_ocorrencia: '2026-02-30' })) === 'DADOS_INVALIDOS', 'Data impossível → erro de dados');
    check((await call('GET', '/ocorrencias-notebook?de=2026-10-20&ate=2026-10-20', { token: tA })).json.length === 1, 'Lista as do período');
    check((await call('GET', '/ocorrencias-notebook', { token: tB })).json.length === 0, 'Professor B não vê');
    check((await call('GET', `/ocorrencias-notebook?turma_id=${turma.id}`, { token: tCoord })).json.length === 1, 'Gestão vê');
    check((await call('PATCH', `/ocorrencias-notebook/${o1.id}`, { token: tA, body: { solucao_adotada: 'Roteador reiniciado' } })).json?.solucao_adotada === 'Roteador reiniciado', 'Dono altera');
    check(codigo(await call('PATCH', `/ocorrencias-notebook/${o1.id}`, { token: tCoord, body: { observacoes: 'X' } })) === 'SEM_PERMISSAO', 'Gestão não altera');
    check(codigo(await call('PATCH', `/ocorrencias-notebook/${o1.id}`, { token: tB, body: { observacoes: 'X' } })) === 'OCORRENCIA_NAO_ENCONTRADA', 'Professor B não altera');

    const foto = (id: string, { t = tA, conteudo = PNG, mime = 'image/png' } = {}) =>
      call('POST', `/ocorrencias-notebook/${id}/fotos?nome=tela.png`, { token: t, body: conteudo, tipo: mime });
    const f1 = await foto(o1.id);
    check(f1.status === 201 && f1.json.path.startsWith(`${profA.id}/${o1.id}/`) && f1.json.url === '', 'Anexa uma foto na pasta do professor e da ocorrência');
    check(existsSync(path.join(dir, 'ocorrencias-fotos', f1.json.path)), 'A foto foi guardada');
    const f2 = await foto(o1.id, { t: tAdmin });
    check(f2.status === 201 && f2.json.path.startsWith(`${profA.id}/`), 'Admin anexa; fica na pasta do professor');
    check((await call('GET', `/ocorrencias-notebook/${o1.id}`, { token: tCoord })).json?.fotos?.length === 2, 'A ocorrência vem com as fotos (gestão vê)');
    check(codigo(await foto(o1.id, { mime: 'application/pdf' })) === 'TIPO_NAO_PERMITIDO', 'PDF não é foto → tipo não permitido');
    check(codigo(await foto(o1.id, { conteudo: Buffer.alloc(10 * MB + 1, 1) })) === 'ARQUIVO_GRANDE_DEMAIS', 'Mais de 10 MB → grande demais');
    check(codigo(await foto(o1.id, { t: tCoord })) === 'SEM_PERMISSAO', 'Gestão não anexa');
    check(codigo(await call('DELETE', `/ocorrencias-notebook/${o1.id}/fotos/${INEXISTENTE}`, { token: tA })) === 'FOTO_NAO_ENCONTRADA', 'Foto inexistente → não encontrada');
    check((await call('DELETE', `/ocorrencias-notebook/${o1.id}/fotos/${f1.json.id}`, { token: tA })).status === 204 && !existsSync(path.join(dir, 'ocorrencias-fotos', f1.json.path)), 'Dono remove uma foto (do banco e do armazenamento)');
    check(codigo(await call('DELETE', `/ocorrencias-notebook/${o1.id}`, { token: tCoord })) === 'SEM_PERMISSAO', 'Gestão não exclui');
    check((await call('DELETE', `/ocorrencias-notebook/${o1.id}`, { token: tA })).status === 204 && !existsSync(path.join(dir, 'ocorrencias-fotos', f2.json.path)), 'Excluir a ocorrência leva as fotos');

    console.log('\n— Ocorrências escolares —');
    const esc = (body: object, t = tA) => call('POST', '/ocorrencias-escolares', { token: t, body });
    const e1 = await esc({ tipo: 'comportamento', descricao: 'Conversa durante a prova', turma: '8°C', disciplina: 'Matemática', alunos: 'Ana Souza, Bruno Lima', data: '2026-10-21' });
    const r1 = e1.json as Escolar;
    check(e1.status === 201 && r1.status === 'nova' && r1.user_id === profA.id && r1.data === '2026-10-21', 'Professor envia a ocorrência para a gestão (nova)');
    await esc({ tipo: 'atraso', descricao: 'Chegou 20 min atrasado' }, tB);
    check(codigo(await esc({ tipo: 'briga', descricao: 'X' })) === 'DADOS_INVALIDOS', 'Tipo inventado → erro de dados');
    check(codigo(await esc({ tipo: 'atraso' })) === 'DADOS_INVALIDOS', 'Sem descrição → erro de dados');
    check((await call('GET', '/ocorrencias-escolares', { token: tA })).json.length === 1, 'Professor vê só as próprias');
    check((await call('GET', '/ocorrencias-escolares?status=nova', { token: tCoord })).json.filter((o: Escolar) => [profA.id, profB.id].includes(o.user_id)).length === 2, 'Gestão vê todas as novas');
    check((await call('GET', `/ocorrencias-escolares?aluno=ana souza&user_id=${profA.id}`, { token: tCoord })).json.length === 1, 'Busca por aluno (sem diferenciar maiúsculas), o que a Tutoria usa');
    check(codigo(await call('GET', `/ocorrencias-escolares/${r1.id}`, { token: tB })) === 'OCORRENCIA_NAO_ENCONTRADA', 'Professor B não abre a do A');
    check((await call('PATCH', `/ocorrencias-escolares/${r1.id}`, { token: tA, body: { alunos: 'Ana Souza' } })).json?.alunos === 'Ana Souza', 'Professor corrige enquanto está "nova"');
    check((await call('POST', `/ocorrencias-escolares/${r1.id}/resposta`, { token: tA, body: { status: 'resolvida' } })).status === 403, 'Professor não responde');
    const resp = await call('POST', `/ocorrencias-escolares/${r1.id}/resposta`, { token: tCoord, body: { status: 'em_andamento', providencias: 'Conversa com a família' } });
    const r2 = resp.json as Escolar;
    check(resp.status === 200 && r2.status === 'em_andamento' && r2.providencias === 'Conversa com a família' && r2.gestao_user_id === coord.id && r2.respondido_em !== null, 'Gestão responde: situação, providências, quem e quando');
    check(r2.visto_pelo_professor === false, 'A resposta fica "não vista" para avisar o professor');
    const vistaPeloProf = ((await call('GET', '/ocorrencias-escolares', { token: tA })).json as { id: string; professor_nome: string; gestao_nome: string }[])
      .find((o) => o.id === r1.id);
    check(vistaPeloProf?.professor_nome === 'Teste profa' && vistaPeloProf.gestao_nome === 'Teste coord', 'A lista traz o nome de quem registrou e de quem respondeu');
    check(codigo(await call('POST', `/ocorrencias-escolares/${r1.id}/resposta`, { token: tCoord, body: { status: 'arquivada' } })) === 'DADOS_INVALIDOS', 'Situação inventada → erro de dados');
    check(codigo(await call('PATCH', `/ocorrencias-escolares/${r1.id}`, { token: tA, body: { descricao: 'Mudei' } })) === 'OCORRENCIA_EM_ATENDIMENTO', 'Em atendimento, o professor não corrige mais');
    check((await call('POST', `/ocorrencias-escolares/${r1.id}/visto`, { token: tCoord })).status === 403, 'Só quem registrou marca como vista');
    check((await call('POST', `/ocorrencias-escolares/${r1.id}/visto`, { token: tA })).json?.visto_pelo_professor === true, 'Professor marca a resposta como vista');
    check(codigo(await call('DELETE', `/ocorrencias-escolares/${r1.id}`, { token: tCoord })) === 'SEM_PERMISSAO', 'Gestão não remove');
    check((await call('DELETE', `/ocorrencias-escolares/${r1.id}`, { token: tA })).status === 204, 'Quem registrou remove');
    check((await call('GET', '/ocorrencias-escolares')).status === 401, 'Sem login não vê');
  } finally {
    server.close();
    const turmas = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    await rm(dir, { recursive: true, force: true });
    console.log(`\n🧹 ${turmas.count} turmas, ${count} usuários de teste (com as ocorrências) e a pasta temporária apagados.`);
    await prisma.$disconnect();
  }

  console.log(falhas === 0 ? '\nTudo certo ✅' : `\n${falhas} falha(s) ❌`);
  if (falhas) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
