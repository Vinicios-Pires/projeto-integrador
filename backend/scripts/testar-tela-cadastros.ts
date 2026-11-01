/**
 * Conferência da Fase 6, Parte 2: as telas de Turmas (com eletivas), Alunos e Matérias ligadas ao
 * backend, num navegador de verdade. Cria usuários e dados de teste (prefixo `teste-tela-cadastros-*`),
 * clica nas telas como uma pessoa faria, confere no banco e apaga tudo no final.
 *
 * Uso: npm run test:tela-cadastros   (precisa do `npm install` no frontend)
 */
import { abrirTelas, check } from './telas';

const PREFIXO = `teste-tela-cadastros-${Date.now()}`;
const nome = (n: string) => `${PREFIXO}-${n}`;

async function main() {
  const tela = await abrirTelas(PREFIXO);
  const { front, page, prisma, email, criarUsuario, visivel, entrar, sair, tokenDe, chamar, fechar } = tela;
  const ids: string[] = [];
  let erro: unknown;

  try {
    const prof = await criarUsuario('prof');
    const coord = await criarUsuario('coord', { roles: ['coordenador'] });
    ids.push(prof.id, coord.id);

    // Dados de partida, pela API: uma turma com um aluno.
    const tProf = await tokenDe(email('prof'));
    const turma = (await chamar('POST', '/turmas', tProf, { nome: nome('7A'), serie: '7º Ano' })).json;
    const aluno = (await chamar('POST', '/alunos', tProf, { turma_id: turma.id, nome: nome('Ana'), numero_chamada: 1 })).json;

    const toastSome = () => page.locator('[data-state=open][role=status], li[role=status]').first().waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    const cartao = (texto: string) => page.locator('div.rounded-xl.shadow-card', { hasText: texto });

    await entrar(email('prof'));

    console.log('\n— Turmas —');
    await page.goto(`${front}/turmas`);
    check(await visivel(nome('7A')), 'A turma do professor aparece na lista');
    check(await cartao(nome('7A')).getByText('/35 alunos').count() === 1 && (await cartao(nome('7A')).locator('strong').first().textContent()) === '1',
      'Com a contagem de alunos (1/35)');

    await page.getByRole('button', { name: 'Nova Turma' }).click();
    await page.getByPlaceholder('Ex: 7º A').fill(nome('8B'));
    await page.getByRole('combobox').filter({ hasText: 'Série' }).click();
    await page.getByRole('option', { name: '8º Ano', exact: true }).click();
    await page.getByRole('button', { name: 'Salvar' }).click();
    check(await visivel('Turma cadastrada!'), 'Nova turma: mostra a confirmação');
    let nova = await prisma.turmas.findFirst({ where: { nome: nome('8B') } });
    check(nova?.user_id === prof.id && nova.serie === '8º Ano', 'E ela é gravada no nome do professor');

    await cartao(nome('8B')).getByRole('button', { name: /editar/i }).click();
    await page.getByPlaceholder('Ex: 7º A').fill(nome('8C'));
    await page.getByRole('button', { name: 'Salvar' }).click();
    check(await visivel('Turma atualizada!'), 'Editar a turma mostra a confirmação');
    nova = await prisma.turmas.findUnique({ where: { id: nova!.id } });
    check(nova?.nome === nome('8C'), 'E o nome muda no banco');

    await cartao(nome('7A')).locator('button.text-destructive').click();
    check(await visivel('Não foi possível excluir'), 'Turma com alunos não pode ser excluída (aviso na tela)');
    check(!!(await prisma.turmas.findUnique({ where: { id: turma.id } })), 'E continua no banco');
    await toastSome();

    await cartao(nome('8C')).locator('button.text-destructive').click();
    check(await visivel('Turma excluída'), 'Turma vazia é excluída');
    check(!(await prisma.turmas.findUnique({ where: { id: nova!.id } })), 'E sai do banco');

    console.log('\n— Eletivas —');
    await page.getByRole('button', { name: /formar turma/i }).click();
    await page.getByPlaceholder('Ex: Eletiva - Química no Esporte').fill(nome('Eletiva'));
    // A lista mostra só os alunos do nível da eletiva (a aluna é do 7º ano).
    await page.getByRole('dialog').getByRole('combobox').filter({ hasText: 'Ensino Médio' }).click();
    await page.getByRole('option', { name: 'Ensino Fundamental II' }).click();
    await page.getByPlaceholder('Buscar aluno por nome ou nº...').fill(nome('Ana'));
    await page.locator('li', { hasText: nome('Ana') }).click();
    await page.getByRole('button', { name: /salvar|criar/i }).last().click();
    check(await visivel('Turma personalizada criada!'), 'Formar eletiva mostra a confirmação');
    const eletiva = await prisma.turmas.findFirst({ where: { nome: nome('Eletiva') }, include: { turma_membros: true } });
    check(eletiva?.tipo === 'personalizada' && eletiva.turma_membros.length === 1 && eletiva.turma_membros[0].aluno_id === aluno.id,
      'A eletiva é gravada com o aluno escolhido');
    check(await cartao(nome('Eletiva')).getByText('alunos selecionados').count() === 1 &&
      (await cartao(nome('Eletiva')).locator('strong').first().textContent()) === '1', 'O cartão mostra 1 aluno selecionado');

    await cartao(nome('Eletiva')).getByRole('button', { name: /gerenciar/i }).click();
    const linhaAna = page.locator('li', { hasText: nome('Ana') });
    check((await linhaAna.getByRole('checkbox').getAttribute('data-state')) === 'checked', 'Ao gerenciar, o aluno já vem marcado');
    await linhaAna.click();
    await page.getByRole('button', { name: /salvar|criar/i }).last().click();
    check(await visivel('Turma atualizada!'), 'Desmarcar e salvar mostra a confirmação');
    check((await prisma.turma_membros.count({ where: { turma_id: eletiva!.id } })) === 0, 'E o aluno sai da eletiva no banco');

    console.log('\n— Alunos —');
    await page.goto(`${front}/alunos`);
    check(await visivel(nome('Ana')), 'O aluno aparece na lista, com a turma');

    await page.getByRole('button', { name: /novo aluno/i }).click();
    await page.getByPlaceholder('Nome completo').fill(nome('Bruno'));
    await page.getByRole('combobox').filter({ hasText: 'Selecionar' }).click();
    await page.getByRole('option', { name: nome('7A'), exact: true }).click();
    await page.locator('input[type=number]').fill('2');
    await page.getByRole('button', { name: 'Salvar' }).click();
    check(await visivel('Aluno cadastrado e ativo na turma!'), 'Novo aluno mostra a confirmação');
    const bruno = await prisma.alunos.findFirst({ where: { nome: nome('Bruno') } });
    check(bruno?.turma_id === turma.id && bruno.numero_chamada === 2 && bruno.serie === '7º Ano', 'E é gravado na turma, com a série dela');
    await toastSome();

    await page.locator('tr', { hasText: nome('Bruno') }).locator('button').last().click();
    check(await visivel('Não foi possível excluir'), 'O professor não exclui aluno (só a gestão): aviso na tela');
    check(!!(await prisma.alunos.findUnique({ where: { id: bruno!.id } })), 'E o aluno continua no banco');

    // A coluna da turma usa o formato da planilha (7°A): a turma 9°Z ainda não existe e é criada.
    const csv = `Numero Chamada,Nome do Aluno,Serie/Turma\n3,${nome('Carla')},9°Z\n4,${nome('Davi')},7Z9\n`;
    await page.locator('input[type=file]').setInputFiles({ name: 'alunos.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    check(await visivel('1 alunos importados!'), 'Importar planilha: importa a linha boa e avisa');
    check(await visivel('Turmas criadas: 9°Z'), 'E avisa a turma criada');
    const carla = await prisma.alunos.findFirst({ where: { nome: nome('Carla') }, include: { turma: true } });
    check(carla?.turma?.nome === '9°Z' && carla.turma.user_id === prof.id, 'A linha boa entra no banco, na turma nova do professor');
    check(!(await prisma.alunos.findFirst({ where: { nome: nome('Davi') } })), 'A linha com turma inválida fica de fora');
    await sair();

    console.log('\n— Alunos pela gestão —');
    await entrar(email('coord'));
    await page.goto(`${front}/alunos`);
    await page.getByPlaceholder('Buscar por nome ou número...').fill(nome('Bruno'));
    await page.locator('tr', { hasText: nome('Bruno') }).locator('button').last().click();
    check(await visivel('Aluno excluído'), 'A gestão exclui o aluno');
    check(!(await prisma.alunos.findUnique({ where: { id: bruno!.id } })), 'E ele sai do banco');
    await sair();

    console.log('\n— Matérias —');
    await entrar(email('prof'));
    await page.goto(`${front}/materias`);
    await page.getByRole('button', { name: /nova matéria|criar matéria/i }).first().click();
    await page.getByPlaceholder('Ex: Química, Robótica, Programação').fill(nome('Robótica'));
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    check(await visivel('Matéria criada!'), 'Nova matéria mostra a confirmação');
    const materia = await prisma.disciplinas.findFirst({ where: { nome: nome('Robótica') } });
    check(materia?.user_id === prof.id, 'E é gravada no nome do professor');

    const cartaoMateria = page.locator('div.rounded-xl.border-2', { hasText: nome('Robótica') });
    await cartaoMateria.getByTitle('Vincular turmas').click();
    await page.getByRole('dialog').getByRole('button', { name: new RegExp(nome('7A')) }).click();
    await page.getByRole('button', { name: 'Salvar vínculos' }).click();
    check(await visivel('Vínculos atualizados!'), 'Vincular turmas mostra a confirmação');
    const vinc = await prisma.turma_disciplinas.findMany({ where: { disciplina_id: materia!.id } });
    check(vinc.length === 1 && vinc[0].turma_id === turma.id && vinc[0].user_id === prof.id, 'O vínculo com a turma é gravado');
    await page.reload();
    check(await cartaoMateria.getByText(nome('7A')).first().waitFor({ timeout: 15_000 }).then(() => true, () => false), 'Ao recarregar, a turma aparece no cartão da matéria');

    await cartaoMateria.locator('button').nth(1).click();
    await page.getByPlaceholder('Ex: Química, Robótica, Programação').fill(nome('Robótica 2'));
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    check(await visivel('Matéria atualizada!'), 'Editar a matéria mostra a confirmação');
    check((await prisma.disciplinas.findUnique({ where: { id: materia!.id } }))?.nome === nome('Robótica 2'), 'E o nome muda no banco');

    await page.locator('div.rounded-xl.border-2', { hasText: nome('Robótica 2') }).locator('button').nth(2).click();
    check(await visivel('Matéria excluída'), 'Excluir a matéria mostra a confirmação');
    check(!(await prisma.disciplinas.findUnique({ where: { id: materia!.id } })) && (await prisma.turma_disciplinas.count({ where: { disciplina_id: materia!.id } })) === 0,
      'E ela sai do banco, com os vínculos');
    await sair();

    console.log('\n— Gestão só lê —');
    await entrar(email('coord'));
    await page.goto(`${front}/materias`);
    check(await visivel('Somente leitura'), 'A gestão vê as matérias em modo somente leitura');
  } catch (err) {
    erro = err;
  }
  await fechar(async () => {
    await prisma.disciplinas.deleteMany({ where: { user_id: { in: ids } } });
    // Apagar as turmas leva junto alunos, membros e vínculos.
    const t = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    console.log(`\n🧹 ${t.count} turmas de teste (com alunos) apagadas.`);
  }, erro);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
