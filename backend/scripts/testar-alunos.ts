/**
 * Conferência da Fase 2, Parte 2: alunos (listar com filtros, ver, cadastrar, editar,
 * excluir, importar planilha) e o padrão C de autorização (todos leem e escrevem, só a
 * gestão exclui). Cria usuários de teste temporários (e-mails `teste-alunos-*`), sobe a
 * API numa porta livre, testa via HTTP e apaga tudo ao final. Não toca no admin real.
 *
 * Uso: npm run test:alunos
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

const PREFIXO = `teste-alunos-${Date.now()}`;
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

type Aluno = { id: string; nome: string; turma_id: string; numero_chamada: number | null; ativo: boolean; turmas: { nome: string } | null };

async function main() {
  const server = app.listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  const ids: string[] = [];

  async function call(method: string, path: string, { body, token }: { body?: unknown; token?: string } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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
    const profA = await criarUsuario('profa', 'professor');
    const profB = await criarUsuario('profb', 'professor');
    ids.push(admin.id, coord.id, profA.id, profB.id);

    const tAdmin = await token('admin');
    const tCoord = await token('coord');
    const tA = await token('profa');
    const tB = await token('profb');
    const criar = (body: unknown, t = tA) => call('POST', '/alunos', { token: t, body });
    const editar = (id: string, body: unknown, t = tA) => call('PATCH', `/alunos/${id}`, { token: t, body });
    const excluir = (id: string, t = tCoord) => call('DELETE', `/alunos/${id}`, { token: t });
    const importar = (linhas: unknown, t = tA) => call('POST', '/alunos/importar', { token: t, body: { linhas } });
    const novaTurma = async (nome: string, serie: string, t = tA) =>
      (await call('POST', '/turmas', { token: t, body: { nome, serie } })).json as { id: string };

    const turma7 = await novaTurma(`${PREFIXO} 7A`, '7º Ano');
    const turma8 = await novaTurma(`${PREFIXO} 8B`, '8º Ano');
    const turmaB = await novaTurma(`${PREFIXO} 9C`, '9º Ano', tB);
    const minhas = [turma7.id, turma8.id, turmaB.id];
    const listar = async (query = '', t = tA) =>
      (await call('GET', `/alunos?turma_id=${minhas.join(',')}${query}`, { token: t })).json as Aluno[];

    console.log('\n— Cadastrar —');
    const a1 = await criar({ turma_id: turma7.id, nome: '  Carla Lima  ', numero_chamada: 3 });
    check(a1.status === 201 && a1.json.nome === 'Carla Lima' && a1.json.ativo === true, 'Professor cadastra aluno (nome sem espaços nas pontas, ativo)');
    check(a1.json?.serie === '7º Ano' && a1.json?.turmas?.nome === `${PREFIXO} 7A` && a1.json?.turmas?.serie === '7º Ano', 'Sem série, herda a da turma; resposta traz a turma');
    const a2 = await criar({
      turma_id: turma7.id, nome: 'Ana Silva', numero_chamada: 1, serie: '7º Ano A', data_nascimento: '2013-04-05',
      email: 'ana@x.com', telefone: '1199999', responsavel: 'Maria', observacoes: 'canhota',
    });
    check(
      a2.status === 201 && a2.json.data_nascimento === '2013-04-05' && a2.json.serie === '7º Ano A' && a2.json.responsavel === 'Maria',
      'Cadastra com todos os campos (data no formato AAAA-MM-DD)',
    );
    const a3 = await criar({ turma_id: turma7.id, nome: 'Bruno Souza' }, tB);
    check(a3.status === 201 && a3.json.numero_chamada === null, 'Outro professor também cadastra na turma (cadastro compartilhado)');
    const a4 = await criar({ turma_id: turma8.id, nome: 'Ana Silva', numero_chamada: 1 }, tCoord);
    check(a4.status === 201, 'Mesmo nome em outra turma é permitido');
    const dup = await criar({ turma_id: turma7.id, nome: 'ANA SILVA' });
    check(dup.status === 409 && codigo(dup) === 'ALUNO_DUPLICADO', 'Mesmo nome na mesma turma (maiúsculas não importam) → duplicado');

    check(codigo(await criar({ turma_id: turma7.id })) === 'DADOS_INVALIDOS', 'Sem nome → erro de dados');
    check(codigo(await criar({ nome: 'X' })) === 'DADOS_INVALIDOS', 'Sem turma → erro de dados');
    check(codigo(await criar({ turma_id: INEXISTENTE, nome: 'X' })) === 'TURMA_INVALIDA', 'Turma inexistente → turma inválida');
    check(codigo(await criar({ turma_id: 'abc', nome: 'X' })) === 'TURMA_INVALIDA', 'Turma malformada → turma inválida (sem erro interno)');
    check(codigo(await criar({ turma_id: turma7.id, nome: 'X', data_nascimento: '2013-02-30' })) === 'DADOS_INVALIDOS', 'Data impossível → erro de dados');
    check(codigo(await criar({ turma_id: turma7.id, nome: 'X', data_nascimento: '05/04/2013' })) === 'DADOS_INVALIDOS', 'Data em outro formato → erro de dados');
    check(codigo(await criar({ turma_id: turma7.id, nome: 'X', numero_chamada: -1 })) === 'DADOS_INVALIDOS', 'Número da chamada negativo → erro de dados');
    check(codigo(await criar({ turma_id: turma7.id, nome: 'X', ativo: 'sim' })) === 'DADOS_INVALIDOS', 'Ativo que não é sim/não → erro de dados');
    check((await call('POST', '/alunos', { body: { turma_id: turma7.id, nome: 'X' } })).status === 401, 'Sem login não cadastra');
    check((await prisma.alunos.count({ where: { nome: 'X', turma_id: { in: minhas } } })) === 0, 'Nenhum aluno inválido foi gravado');

    console.log('\n— Listar e ver —');
    const todos = await listar();
    check(todos.length === 4, 'Lista os alunos das turmas pedidas');
    check(
      JSON.stringify(todos.map((a) => a.nome)) === JSON.stringify(['Ana Silva', 'Carla Lima', 'Bruno Souza', 'Ana Silva']),
      'Ordem padrão: turma, depois número da chamada (sem número por último)',
    );
    check((await listar('', tB)).length === 4 && (await listar('', tCoord)).length === 4, 'Outro professor e a gestão veem os mesmos alunos');
    const so7 = (await call('GET', `/alunos?turma_id=${turma7.id}`, { token: tA })).json as Aluno[];
    check(so7.length === 3 && so7.every((a) => a.turma_id === turma7.id), 'Filtro por uma turma');
    const repetido = (await call('GET', `/alunos?turma_id=${turma7.id}&turma_id=${turma8.id}`, { token: tA })).json as Aluno[];
    check(repetido.length === 4, 'Filtro por várias turmas (parâmetro repetido)');
    check(JSON.stringify((await listar('&ordem=nome')).map((a) => a.nome)) === JSON.stringify(['Ana Silva', 'Ana Silva', 'Bruno Souza', 'Carla Lima']), 'Ordem por nome');
    const porNumero = await listar('&ordem=numero_chamada');
    check(porNumero[porNumero.length - 1]?.nome === 'Bruno Souza' && porNumero[0]?.numero_chamada === 1, 'Ordem por número da chamada');
    check(todos[0]?.turmas?.nome === `${PREFIXO} 7A`, 'Cada aluno traz o nome e a série da turma');
    check(codigo(await call('GET', '/alunos?ativo=sim', { token: tA })) === 'DADOS_INVALIDOS', 'Filtro "ativo" inválido → erro de dados');
    check(codigo(await call('GET', '/alunos?ordem=idade', { token: tA })) === 'DADOS_INVALIDOS', 'Ordem inválida → erro de dados');
    check(codigo(await call('GET', '/alunos?turma_id=abc', { token: tA })) === 'DADOS_INVALIDOS', 'Turma malformada no filtro → erro de dados');
    check((await call('GET', '/alunos')).status === 401, 'Sem login não lista');
    const v = await call('GET', `/alunos/${a2.json.id}`, { token: tB });
    check(v.status === 200 && v.json.email === 'ana@x.com', 'Qualquer usuário logado vê um aluno pelo id');
    check(codigo(await call('GET', `/alunos/${INEXISTENTE}`, { token: tA })) === 'ALUNO_NAO_ENCONTRADO', 'Aluno inexistente → não encontrado');
    check(codigo(await call('GET', '/alunos/xyz', { token: tA })) === 'ALUNO_NAO_ENCONTRADO', 'Id malformado → não encontrado');

    console.log('\n— Editar —');
    const e1 = await editar(a1.json.id, { numero_chamada: 2 }, tB);
    check(e1.status === 200 && e1.json.numero_chamada === 2 && e1.json.nome === 'Carla Lima', 'Outro professor edita só o campo enviado');
    const inativo = await editar(a3.json.id, { ativo: false });
    check(inativo.json?.ativo === false, 'Inativa o aluno');
    const ativos = await listar('&ativo=true');
    const inativos = await listar('&ativo=false');
    check(ativos.length === 3 && inativos.length === 1 && inativos[0].id === a3.json.id, 'Filtro de ativos e inativos');
    const mover = await editar(a1.json.id, { turma_id: turma8.id });
    check(mover.status === 200 && mover.json.turmas?.nome === `${PREFIXO} 8B` && mover.json.serie === '7º Ano', 'Troca de turma (série fica como estava)');
    check(codigo(await editar(a2.json.id, { turma_id: turma8.id })) === 'ALUNO_DUPLICADO', 'Mover para turma que já tem aluno com esse nome → duplicado');
    check(codigo(await editar(a1.json.id, { nome: 'ANA SILVA' })) === 'ALUNO_DUPLICADO', 'Renomear para nome que já existe na turma → duplicado');
    check((await editar(a2.json.id, { nome: 'Ana SILVA' })).status === 200, 'Mudar só as maiúsculas do próprio nome é permitido');
    check((await editar(a2.json.id, { data_nascimento: null })).json?.data_nascimento === null, 'Apaga a data de nascimento');
    check(codigo(await editar(a2.json.id, {})) === 'DADOS_INVALIDOS', 'Nada para alterar → erro de dados');
    check(codigo(await editar(a2.json.id, { turma_id: null })) === 'DADOS_INVALIDOS', 'Tirar a turma → erro de dados');
    check(codigo(await editar(a2.json.id, { nome: ' ' })) === 'DADOS_INVALIDOS', 'Nome vazio → erro de dados');
    check(codigo(await editar(a2.json.id, { turma_id: INEXISTENTE })) === 'TURMA_INVALIDA', 'Turma inexistente → turma inválida');
    check(codigo(await editar(INEXISTENTE, { ativo: true })) === 'ALUNO_NAO_ENCONTRADO', 'Aluno inexistente → não encontrado');

    console.log('\n— Excluir —');
    const r = await excluir(a3.json.id, tA);
    check(r.status === 403 && codigo(r) === 'SEM_PERMISSAO', 'Professor não exclui aluno (só inativa)');
    check((await prisma.alunos.count({ where: { id: a3.json.id } })) === 1, 'O aluno continua lá');
    check((await excluir(a3.json.id)).status === 204, 'Gestão (coordenação) exclui');
    check(codigo(await call('GET', `/alunos/${a3.json.id}`, { token: tA })) === 'ALUNO_NAO_ENCONTRADO', 'Depois de excluído, não aparece mais');
    check((await excluir(a4.json.id, tAdmin)).status === 204, 'Admin exclui');
    check(codigo(await excluir(INEXISTENTE)) === 'ALUNO_NAO_ENCONTRADO', 'Aluno inexistente → não encontrado');
    check((await call('DELETE', `/alunos/${a1.json.id}`)).status === 401, 'Sem login não exclui');

    console.log('\n— Importar planilha —');
    const t7c = await novaTurma('7º C', '7º Ano');
    await criar({ turma_id: t7c.id, nome: 'Daniel Reis' });
    const imp = await importar([
      { numero_chamada: 1, nome: 'Ana Prado', turma: '7°A' },
      { numero_chamada: 2, nome: 'Bruno Melo', turma: '7 a' },
      { numero_chamada: 1, nome: 'Carla Dias', turma: '8ºB' },
      { numero_chamada: 4, nome: '', turma: '7A' },
      { nome: 'Xavier', turma: 'sétimo' },
      { nome: 'ana prado', turma: '7A' },
      { numero_chamada: '5', nome: 'Yuri', turma: '7A' },
      { nome: 'Daniel Reis', turma: '7c' },
      { numero_chamada: 9, nome: 'Eva Luz', turma: '7 C' },
      { nome: 'Fábio EM', turma: '1A' },
    ]);
    check(imp.status === 200 && imp.json.importados === 5, 'Importa as linhas válidas (5 de 10)');
    check(JSON.stringify(imp.json?.turmas_criadas) === JSON.stringify(['7°A', '8°B', '1°A']), 'Cria as turmas que o professor ainda não tem');
    check(
      JSON.stringify(imp.json?.erros?.map((e: { linha: number }) => e.linha)) === JSON.stringify([4, 5, 6, 7, 8]),
      'Linhas com problema são puladas e informadas pela posição',
    );
    check(
      /nome vazio/.test(imp.json.erros[0].motivo) && /formato de turma/.test(imp.json.erros[1].motivo) &&
        /já existe/.test(imp.json.erros[2].motivo) && /já existe em 7°C/.test(imp.json.erros[4].motivo),
      'Motivos: nome vazio, turma inválida, duplicado na planilha e já cadastrado',
    );
    const criadas = await prisma.turmas.findMany({ where: { user_id: profA.id, nome: { in: ['7°A', '8°B', '1°A'] } } });
    const serie = (n: string) => criadas.find((t) => t.nome === n)?.serie;
    check(criadas.length === 3 && serie('7°A') === '7º Ano' && serie('1°A') === '1º Ano EM' && criadas.every((t) => t.turno === 'Manhã'), 'Turmas criadas no nome do professor, com série e turno');
    const eva = await prisma.alunos.findFirst({ where: { nome: 'Eva Luz' } });
    check(eva?.turma_id === t7c.id && eva?.serie === '7º Ano' && eva?.numero_chamada === 9, '"7 C" encontra a turma "7º C" que já existia');
    const bruno = await prisma.alunos.findFirst({ where: { nome: 'Bruno Melo', turma: { user_id: profA.id } } });
    check(bruno?.turma_id === criadas.find((t) => t.nome === '7°A')?.id, '"7 a" e "7°A" caem na mesma turma nova');

    const reimp = await importar([{ nome: 'Ana Prado', turma: '7A' }, { nome: 'Eva Luz', turma: '7C' }]);
    check(reimp.json?.importados === 0 && reimp.json?.erros?.length === 2 && reimp.json?.turmas_criadas?.length === 0, 'Importar de novo não duplica nada');
    const impB = await importar([{ nome: 'Gil Rocha', turma: '7A' }], tB);
    check(JSON.stringify(impB.json?.turmas_criadas) === JSON.stringify(['7°A']), 'Outro professor ganha a própria turma 7°A (não usa a do colega)');

    check(codigo(await importar([])) === 'DADOS_INVALIDOS', 'Lista vazia → erro de dados');
    check(codigo(await call('POST', '/alunos/importar', { token: tA, body: {} })) === 'DADOS_INVALIDOS', 'Sem a lista → erro de dados');
    check(codigo(await importar(Array(2001).fill({ nome: 'Z', turma: '7A' }))) === 'DADOS_INVALIDOS', 'Mais de 2000 linhas → erro de dados');
    const grande = await importar([{ nome: 'x'.repeat(1_100_000), turma: '7A' }]);
    check(grande.status === 413 && codigo(grande) === 'CORPO_GRANDE_DEMAIS', 'Envio acima de 1 MB → recusado (sem erro interno)');
    check((await call('POST', '/alunos/importar', { body: { linhas: [{ nome: 'Z', turma: '7A' }] } })).status === 401, 'Sem login não importa');
  } finally {
    server.close();
    // turmas.user_id não apaga em cascata (vira nulo); apagar as turmas leva junto os alunos delas.
    const turmas = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    const { count } = await prisma.usuarios.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    console.log(`\n🧹 ${turmas.count} turmas (com seus alunos) e ${count} usuários de teste apagados.`);
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
