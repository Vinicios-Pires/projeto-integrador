/**
 * Conferência da Fase 4, Parte 7: aprovação de cada plano de aula pela gestão (padrão E) e anexos
 * dos planos (documento e atividade adaptada, pelo correio de arquivos). Usa uma pasta temporária
 * como armazenamento, cria usuários de teste (e-mails `teste-aprovacao-*`), turmas, planejamentos e
 * aulas, testa via HTTP e apaga tudo ao final.
 *
 * Uso: npm run test:aprovacao
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

const PREFIXO = `teste-aprovacao-${Date.now()}`;
const SENHA = 'SenhaDeTeste123';
const email = (nome: string) => `${PREFIXO}-${nome}@prof.educacao.sp.gov.br`;
const INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const PDF = Buffer.from('%PDF-1.4\nplano de aula de teste\n%%EOF');
const MB = 1024 * 1024;

type Plano = { id: string; status: string; aprovado_por: string | null; data_aprovacao: string | null; comentario_aprovacao: string | null; conteudo: string | null };
type Anexo = { id: string; plano_id: string; user_id: string; nome_arquivo: string; storage_path: string; mime_type: string; tamanho_bytes: number; tipo: string };

async function main() {
  // O armazenamento é escolhido ao carregar a API: a pasta temporária vem antes.
  const dir = await mkdtemp(path.join(tmpdir(), 'painel-anexos-'));
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
    try { json = text ? JSON.parse(text) : null; } catch { /* conteúdo binário */ }
    return { status: res.status, bytes, json };
  }
  const token = async (nome: string) =>
    (await call('POST', '/auth/login', { body: { email: email(nome), senha: SENHA } })).json.token as string;
  const codigo = (r: { json: { error?: { code: string } } | null }) => r.json?.error?.code;

  try {
    const admin = await criarUsuario('admin', 'admin');
    const coord = await criarUsuario('coord', 'coordenador');
    const vice = await criarUsuario('vice', 'vice_direcao');
    const profA = await criarUsuario('profa', 'professor');
    const profB = await criarUsuario('profb', 'professor');
    ids.push(admin.id, coord.id, vice.id, profA.id, profB.id);
    const tAdmin = await token('admin');
    const tCoord = await token('coord');
    const tVice = await token('vice');
    const tA = await token('profa');
    const tB = await token('profb');

    const post = async (url: string, body: unknown, t = tA) => (await call('POST', url, { token: t, body })).json;
    const turma = await post('/turmas', { nome: `${PREFIXO} 8A`, serie: '8º Ano' });
    const plan = await post('/planejamentos', { turma_id: turma.id, bimestre: 1 });
    const [p1, p2, p3] = (await post(`/planejamentos/${plan.id}/aulas`, { datas: ['2026-03-02', '2026-03-04', '2026-03-06'] })) as Plano[];

    const aprovar = (body: object, t = tCoord) => call('POST', '/planos-aula/aprovacao', { token: t, body });
    const plano = async (id: string) => (await call('GET', `/planos-aula/${id}`, { token: tA })).json as Plano;

    console.log('\n— Aprovação pela gestão —');
    const ap = await aprovar({ ids: [p1.id, p2.id], status: 'aprovado', comentario: 'Bem estruturado' });
    const a1 = ap.json?.[0] as Plano;
    check(ap.status === 200 && ap.json.length === 2 && ap.json.every((p: Plano) => p.status === 'aprovado'), 'Coordenação aprova duas aulas de uma vez');
    check(a1.aprovado_por === coord.id && a1.comentario_aprovacao === 'Bem estruturado' && a1.data_aprovacao !== null, 'Grava quem aprovou, quando e o comentário');
    const dev = await aprovar({ ids: [p3.id], status: 'ajustado', comentario: 'Detalhe a avaliação' }, tVice);
    check(dev.json?.[0]?.status === 'ajustado' && dev.json[0].aprovado_por === vice.id, 'Vice-direção devolve uma aula para ajuste');
    check(codigo(await aprovar({ ids: [p1.id], status: 'aprovado' }, tA)) === 'SEM_PERMISSAO', 'Professor não aprova (nem a própria aula)');
    check(codigo(await aprovar({ ids: [p1.id], status: 'validado' })) === 'DADOS_INVALIDOS', 'Situação inventada → erro de dados');
    check(codigo(await aprovar({ ids: [] , status: 'aprovado' })) === 'DADOS_INVALIDOS', 'Sem aulas → erro de dados');
    check(codigo(await aprovar({ ids: [p1.id, INEXISTENTE], status: 'aprovado' })) === 'PLANO_NAO_ENCONTRADO', 'Com uma aula inexistente, nenhuma muda');
    check((await call('POST', '/planos-aula/aprovacao', { body: { ids: [p1.id], status: 'aprovado' } })).status === 401, 'Sem login não aprova');
    check((await call('GET', `/planos-aula?status=aprovado&turma_id=${turma.id}`, { token: tCoord })).json?.length === 2, 'Filtra as aulas aprovadas (o que o painel da gestão conta)');

    const editada = await call('PATCH', `/planos-aula/${p1.id}`, { token: tA, body: { conteudo: 'Mudei depois de aprovado' } });
    check(editada.json?.status === 'pendente' && editada.json.aprovado_por === null && editada.json.data_aprovacao === null, 'Aula aprovada editada pelo professor volta a pendente');
    check(editada.json?.comentario_aprovacao === 'Bem estruturado', 'O comentário da gestão continua lá para o professor ler');
    await call('PATCH', '/planos-aula/lote', { token: tA, body: { ids: [p2.id, p3.id], dados: { recursos: 'Quadro' } } });
    check((await plano(p2.id)).status === 'pendente' && (await plano(p3.id)).status === 'pendente', '"Copiar para baixo" também volta as aulas a pendente');
    await aprovar({ ids: [p2.id], status: 'aprovado' });
    const volta = await aprovar({ ids: [p2.id], status: 'pendente' }, tAdmin);
    check(volta.json?.[0]?.status === 'pendente' && volta.json[0].aprovado_por === null, 'Gestão (admin) volta uma aula a pendente');
    await call('POST', `/planejamentos/${plan.id}/status`, { token: tCoord, body: { status: 'validado' } });
    check((await aprovar({ ids: [p2.id], status: 'aprovado' })).json?.[0]?.status === 'aprovado', 'Dá para aprovar aulas de planejamento validado (o conteúdo não muda)');
    await call('POST', `/planejamentos/${plan.id}/status`, { token: tCoord, body: { status: 'rascunho' } });

    console.log('\n— Anexos —');
    const enviar = (id: string, { t = tA, tipo = 'documento', nome = 'Roteiro da aula.pdf', conteudo = PDF, mime = 'application/pdf' } = {}) =>
      call('POST', `/planos-aula/${id}/anexos?tipo=${tipo}&nome=${encodeURIComponent(nome)}`, { token: t, body: conteudo, tipo: mime });
    const listar = async (id: string, t = tA, extra = '') => (await call('GET', `/planos-aula/${id}/anexos${extra}`, { token: t })).json as Anexo[];

    const e1 = await enviar(p1.id);
    const an1 = e1.json as Anexo;
    check(e1.status === 201 && an1.nome_arquivo === 'Roteiro da aula.pdf' && an1.tipo === 'documento' && an1.mime_type === 'application/pdf', 'Professor anexa um documento à aula');
    check(an1.tamanho_bytes === PDF.length && typeof an1.tamanho_bytes === 'number', 'Tamanho como número');
    check(an1.storage_path.startsWith(`${profA.id}/${p1.id}/`) && existsSync(path.join(dir, 'plano-anexos', an1.storage_path)), 'O arquivo vai para a pasta do professor e da aula');
    const e2 = await enviar(p1.id, { tipo: 'adaptada', nome: 'Atividade adaptada.png', conteudo: Buffer.from('imagem'), mime: 'image/png', t: tAdmin });
    check(e2.status === 201 && e2.json.user_id === profA.id && e2.json.storage_path.startsWith(`${profA.id}/`), 'Admin anexa; o arquivo fica na pasta do professor dono');
    check((await listar(p1.id)).length === 2 && (await listar(p1.id, tA, '?tipo=adaptada')).length === 1, 'Lista os anexos da aula, e por tipo');
    check((await listar(p1.id, tCoord)).length === 2, 'Gestão vê os anexos');
    check(codigo(await call('GET', `/planos-aula/${p1.id}/anexos`, { token: tB })) === 'PLANO_NAO_ENCONTRADO', 'Professor B não vê');
    const link = await call('GET', `/files/plano-anexos/url?path=${encodeURIComponent(an1.storage_path)}`, { token: tCoord });
    check(link.status === 200 && typeof link.json.url === 'string', 'Gestão abre o anexo pelo link temporário do correio de arquivos');
    const baixado = await call('GET', link.json.url);
    check(baixado.status === 200 && baixado.bytes.equals(PDF), 'O link entrega o arquivo certo');

    check(codigo(await enviar(p1.id, { tipo: 'foto' })) === 'DADOS_INVALIDOS', 'Tipo de anexo inventado → erro de dados');
    check(codigo(await enviar(p1.id, { mime: 'application/x-msdownload' })) === 'TIPO_NAO_PERMITIDO', 'Arquivo executável → tipo não permitido');
    check(codigo(await enviar(p1.id, { conteudo: Buffer.alloc(20 * MB + 1, 1) })) === 'ARQUIVO_GRANDE_DEMAIS', 'Mais de 20 MB → grande demais');
    check(codigo(await enviar(p1.id, { t: tB })) === 'PLANO_NAO_ENCONTRADO', 'Professor B não anexa');
    check(codigo(await enviar(p1.id, { t: tCoord })) === 'SEM_PERMISSAO', 'Gestão não anexa');
    check((await prisma.plano_anexos.count({ where: { plano_id: p1.id } })) === 2, 'Nenhum envio recusado ficou gravado');

    await call('POST', `/planejamentos/${plan.id}/status`, { token: tCoord, body: { status: 'validado' } });
    check(codigo(await enviar(p1.id)) === 'PLANEJAMENTO_VALIDADO', 'Planilha validada não recebe anexos');
    check(codigo(await call('DELETE', `/planos-aula/${p1.id}/anexos/${an1.id}`, { token: tA })) === 'PLANEJAMENTO_VALIDADO', 'Nem perde');
    await call('POST', `/planejamentos/${plan.id}/status`, { token: tCoord, body: { status: 'rascunho' } });

    check(codigo(await call('DELETE', `/planos-aula/${p1.id}/anexos/${an1.id}`, { token: tCoord })) === 'SEM_PERMISSAO', 'Gestão não apaga anexo');
    check(codigo(await call('DELETE', `/planos-aula/${p2.id}/anexos/${an1.id}`, { token: tA })) === 'ANEXO_NAO_ENCONTRADO', 'Anexo de outra aula → não encontrado');
    check((await call('DELETE', `/planos-aula/${p1.id}/anexos/${an1.id}`, { token: tA })).status === 204, 'Dono apaga um anexo');
    check(!existsSync(path.join(dir, 'plano-anexos', an1.storage_path)) && (await listar(p1.id)).length === 1, 'A linha e o arquivo saem');

    const restante = e2.json as Anexo;
    check((await call('DELETE', `/planos-aula/${p1.id}`, { token: tA })).status === 204, 'Dono exclui a aula com anexo');
    check(
      !existsSync(path.join(dir, 'plano-anexos', restante.storage_path)) && (await prisma.plano_anexos.count({ where: { plano_id: p1.id } })) === 0,
      'Excluir a aula leva os anexos e os arquivos',
    );
  } finally {
    server.close();
    // Apagar as turmas leva planejamentos, aulas e anexos; depois os usuários.
    const turmas = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    await rm(dir, { recursive: true, force: true });
    console.log(`\n🧹 ${turmas.count} turmas, ${count} usuários de teste e a pasta temporária de arquivos apagados.`);
    await prisma.$disconnect();
  }

  console.log(falhas === 0 ? '\nTudo certo ✅' : `\n${falhas} falha(s) ❌`);
  if (falhas) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
