/**
 * Conferência da Fase 4, Parte 5: planejamento bimestral, com o padrão A para ver e o fluxo de
 * validação pela gestão (rascunho → aguardando validação → validado). Cria usuários de teste
 * temporários (e-mails `teste-planej-*`), turmas e matérias, testa via HTTP e apaga tudo ao final.
 *
 * Uso: npm run test:planejamentos
 */
import 'dotenv/config';
import type { AddressInfo } from 'node:net';
import type { app_role } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';

let falhas = 0;
function check(ok: boolean, descricao: string) {
  console.log(`${ok ? '✅' : '❌'} ${descricao}`);
  if (!ok) falhas++;
}

const PREFIXO = `teste-planej-${Date.now()}`;
const SENHA = 'SenhaDeTeste123';
const email = (nome: string) => `${PREFIXO}-${nome}@prof.educacao.sp.gov.br`;
const INEXISTENTE = '00000000-0000-4000-8000-000000000000';

async function criarUsuario(nome: string, role: app_role) {
  return prisma.usuarios.create({
    data: {
      email: email(nome),
      senha_hash: await hashPassword(SENHA),
      profile: { create: { nome: `Teste ${nome}`, email: email(nome), status: 'ativo' } },
      user_roles: { create: { role } },
    },
  });
}

type Planejamento = {
  id: string; user_id: string; turma_id: string; disciplina_id: string | null; bimestre: number; ano: number; status: string;
  validado_por: string | null; validado_em: string | null; observacao_validacao: string | null;
  turmas: { nome: string } | null; disciplinas: { nome: string } | null;
};

async function main() {
  const server = app.listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  const ids: string[] = [];

  async function call(method: string, path: string, { body, token }: { body?: unknown; token?: string } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, text, json: text ? JSON.parse(text) : null };
  }
  const token = async (nome: string) =>
    (await call('POST', '/auth/login', { body: { email: email(nome), senha: SENHA } })).json.token as string;
  const codigo = (r: { json: { error?: { code: string } } | null }) => r.json?.error?.code;

  try {
    const admin = await criarUsuario('admin', 'admin');
    const coord = await criarUsuario('coord', 'coordenador');
    const direcao = await criarUsuario('direcao', 'direcao');
    const profA = await criarUsuario('profa', 'professor');
    const profB = await criarUsuario('profb', 'professor');
    ids.push(admin.id, coord.id, direcao.id, profA.id, profB.id);
    const tAdmin = await token('admin');
    const tCoord = await token('coord');
    const tDirecao = await token('direcao');
    const tA = await token('profa');
    const tB = await token('profb');

    const post = async (path: string, body: unknown, t = tA) => (await call('POST', path, { token: t, body })).json;
    const turma = await post('/turmas', { nome: `${PREFIXO} 6A`, serie: '6º Ano' });
    const turmaB = await post('/turmas', { nome: `${PREFIXO} 6B`, serie: '6º Ano' }, tB);
    const mat = await post('/disciplinas', { nome: `${PREFIXO} Arte` });
    const matB = await post('/disciplinas', { nome: `${PREFIXO} Inglês` }, tB);

    const abrir = (body: object, t = tA) => call('POST', '/planejamentos', { token: t, body });
    const status = (id: string, body: object, t = tA) => call('POST', `/planejamentos/${id}/status`, { token: t, body });
    const lista = async (query: string, t = tA) => (await call('GET', `/planejamentos?${query}`, { token: t })).json as Planejamento[];
    const ano = new Date().getFullYear();

    console.log('\n— Abrir planejamento —');
    const p1 = await abrir({ turma_id: turma.id, disciplina_id: mat.id, bimestre: 1 });
    const r1 = p1.json as Planejamento;
    check(p1.status === 201 && r1.status === 'rascunho' && r1.user_id === profA.id && r1.ano === ano, 'Professor abre o planejamento: rascunho, no ano atual');
    check(r1.turmas?.nome === `${PREFIXO} 6A` && r1.disciplinas?.nome === `${PREFIXO} Arte`, 'Vem com o nome da turma e da matéria');
    const deNovo = await abrir({ turma_id: turma.id, disciplina_id: mat.id, bimestre: 1 });
    check(deNovo.status === 200 && deNovo.json.id === r1.id, 'Abrir de novo devolve o mesmo (não duplica)');
    const semMat = await abrir({ turma_id: turma.id, bimestre: 1 });
    const semMat2 = await abrir({ turma_id: turma.id, bimestre: 1 });
    check(semMat.status === 201 && semMat2.status === 200 && semMat2.json.id === semMat.json.id && semMat.json.disciplina_id === null, 'Sem matéria também não duplica');
    const p2 = await abrir({ turma_id: turma.id, disciplina_id: mat.id, bimestre: 2, ano: ano + 1 });
    check(p2.status === 201 && p2.json.ano === ano + 1, 'Outro bimestre e ano é outro planejamento');
    check(codigo(await abrir({ bimestre: 1 })) === 'DADOS_INVALIDOS', 'Sem turma → erro de dados');
    check(codigo(await abrir({ turma_id: turma.id })) === 'DADOS_INVALIDOS', 'Sem bimestre → erro de dados');
    check(codigo(await abrir({ turma_id: turma.id, bimestre: 5 })) === 'DADOS_INVALIDOS', 'Bimestre 5 → erro de dados');
    check(codigo(await abrir({ turma_id: turma.id, bimestre: 1, ano: 1999 })) === 'DADOS_INVALIDOS', 'Ano fora do intervalo → erro de dados');
    check(codigo(await abrir({ turma_id: turmaB.id, bimestre: 1 })) === 'TURMA_INVALIDA', 'Turma de outro professor → turma inválida');
    check(codigo(await abrir({ turma_id: turma.id, disciplina_id: matB.id, bimestre: 1 })) === 'DISCIPLINA_INVALIDA', 'Matéria de outro professor → matéria inválida');
    const doB = await abrir({ turma_id: turmaB.id, disciplina_id: matB.id, bimestre: 1 }, tB);
    check(doB.status === 201, 'Professor B abre o dele');

    console.log('\n— Ver —');
    check((await lista('')).length === 3, 'Professor vê os próprios planejamentos');
    check((await lista(`bimestre=1&ano=${ano}`)).length === 2, 'Filtra por bimestre e ano');
    check((await lista(`disciplina_id=${mat.id}`)).length === 2, 'Filtra por matéria');
    check((await lista(`user_id=${profB.id}`)).length === 0, 'Filtrar por outro professor não mostra os dele');
    check((await lista(`turma_id=${turma.id}`, tB)).length === 0, 'Professor B não vê os do A');
    check((await lista(`turma_id=${turma.id}`, tCoord)).length === 3, 'Gestão vê todos');
    check((await lista(`user_id=${profB.id}`, tCoord)).length === 1, 'Gestão filtra por professor');
    check((await lista('')).map((p) => p.ano)[0] === ano + 1, 'Ordem: ano mais recente primeiro');
    check((await call('GET', `/planejamentos/${r1.id}`, { token: tCoord })).json?.id === r1.id, 'Gestão abre um planejamento');
    check(codigo(await call('GET', `/planejamentos/${r1.id}`, { token: tB })) === 'PLANEJAMENTO_NAO_ENCONTRADO', 'Professor B não abre o do A');
    check(codigo(await call('GET', '/planejamentos?ano=abc', { token: tA })) === 'DADOS_INVALIDOS', 'Ano inválido no filtro → erro de dados');

    console.log('\n— Validação —');
    check(codigo(await status(r1.id, { status: 'validado' })) === 'SEM_PERMISSAO', 'Professor não valida o próprio planejamento');
    check(codigo(await status(r1.id, { status: 'aguardando_validacao' }, tCoord)) === 'SEM_PERMISSAO', 'Gestão não envia por ele');
    check(codigo(await status(r1.id, { status: 'aguardando_validacao' }, tB)) === 'PLANEJAMENTO_NAO_ENCONTRADO', 'Professor B não mexe no do A');
    check(codigo(await status(r1.id, { status: 'aprovado' })) === 'DADOS_INVALIDOS', 'Situação inventada → erro de dados');
    check(codigo(await status(r1.id, { status: 'rascunho' }, tCoord)) === 'STATUS_INVALIDO', 'Rascunho para rascunho → mudança inválida');
    const enviado = await status(r1.id, { status: 'aguardando_validacao' });
    check(enviado.status === 200 && enviado.json.status === 'aguardando_validacao', 'Dono envia para validação');
    check(codigo(await status(r1.id, { status: 'aguardando_validacao' })) === 'STATUS_INVALIDO', 'Enviar de novo → mudança inválida');
    const ajustes = await status(r1.id, { status: 'rascunho', observacao: 'Detalhar a avaliação' }, tCoord);
    check(ajustes.json?.status === 'rascunho' && ajustes.json.observacao_validacao === 'Detalhar a avaliação', 'Gestão pede ajustes: volta a rascunho, com a observação');
    await status(r1.id, { status: 'aguardando_validacao' });
    const validado = await status(r1.id, { status: 'validado', observacao: 'Ótimo' }, tDirecao);
    const v = validado.json as Planejamento;
    check(validado.status === 200 && v.status === 'validado' && v.validado_por === direcao.id && v.observacao_validacao === 'Ótimo', 'Direção valida: grava quem validou e a observação');
    check(v.validado_em !== null && Math.abs(Date.parse(v.validado_em) - Date.now()) < 120_000, 'Grava quando validou');
    check(codigo(await status(r1.id, { status: 'aguardando_validacao' })) === 'STATUS_INVALIDO', 'Validado não volta para "aguardando"');
    check(codigo(await call('DELETE', `/planejamentos/${r1.id}`, { token: tA })) === 'PLANEJAMENTO_VALIDADO', 'Validado não pode ser excluído');
    const reaberto = await status(r1.id, { status: 'rascunho' }, tCoord);
    check(reaberto.json?.status === 'rascunho' && reaberto.json.validado_por === null && reaberto.json.validado_em === null, 'Gestão reabre: limpa quem validou e quando');
    check(reaberto.json?.observacao_validacao === 'Ótimo', 'Reabrir sem observação mantém a anterior');
    check((await status(semMat.json.id, { status: 'validado' }, tCoord)).json?.status === 'validado', 'Gestão valida direto do rascunho (botão da tela)');
    check((await status(doB.json.id, { status: 'aguardando_validacao' }, tAdmin)).json?.status === 'aguardando_validacao', 'Admin pode enviar pelo professor');
    check((await call('POST', `/planejamentos/${r1.id}/status`, { body: { status: 'validado' } })).status === 401, 'Sem login não muda');

    console.log('\n— Excluir —');
    // Uma aula ligada ao planejamento continua existindo depois de excluí-lo.
    const aula = await prisma.planos_aula.create({ data: { user_id: profA.id, turma_id: turma.id, data_aula: new Date('2026-03-02'), planejamento_id: p2.json.id } });
    check(codigo(await call('DELETE', `/planejamentos/${p2.json.id}`, { token: tB })) === 'PLANEJAMENTO_NAO_ENCONTRADO', 'Professor B não exclui');
    check(codigo(await call('DELETE', `/planejamentos/${p2.json.id}`, { token: tCoord })) === 'SEM_PERMISSAO', 'Gestão não exclui');
    check((await call('DELETE', `/planejamentos/${p2.json.id}`, { token: tA })).status === 204, 'Dono exclui o rascunho');
    const aulaDepois = await prisma.planos_aula.findUnique({ where: { id: aula.id } });
    check(aulaDepois !== null && aulaDepois.planejamento_id === null, 'As aulas dele continuam existindo, fora do planejamento');
    check(codigo(await call('DELETE', `/planejamentos/${INEXISTENTE}`, { token: tA })) === 'PLANEJAMENTO_NAO_ENCONTRADO', 'Inexistente → não encontrado');
  } finally {
    server.close();
    // Apagar as turmas leva planejamentos e aulas (antes dos usuários, que validaram).
    const turmas = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    console.log(`\n🧹 ${turmas.count} turmas (com planejamentos e aulas) e ${count} usuários de teste apagados.`);
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
