/**
 * Conferência da Fase 6, Parte 5: Diário do Professor, Agenda (rotina, agenda da escola e apoio presencial),
 * lembretes do painel, painel da gestão e relatórios ligados ao backend, num navegador de verdade. Cria
 * usuários e dados de teste (prefixo `teste-tela-diario-*`), confere no banco e apaga tudo no final.
 *
 * Uso: npm run test:tela-diario-agenda   (precisa do `npm install` no frontend)
 */
import { abrirTelas, check } from './telas';

const PREFIXO = `teste-tela-diario-${Date.now()}`;
const nome = (n: string) => `${PREFIXO}-${n}`;

async function noBanco<T>(ler: () => Promise<T>, ok: (v: T) => boolean, ms = 10_000): Promise<boolean> {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if (ok(await ler())) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  const tela = await abrirTelas(PREFIXO);
  const { front, page, prisma, email, criarUsuario, visivel, entrar, sair, tokenDe, chamar, fechar } = tela;
  const ids: string[] = [];
  let erro: unknown;

  try {
    const prof = await criarUsuario('prof');
    const coord = await criarUsuario('coord', { roles: ['coordenador'] });
    ids.push(prof.id, coord.id);

    // Dados de partida, pela API: turma com dois alunos, matéria ligada, uma nota (para o relatório),
    // um evento da escola e um apoio presencial marcado pela coordenação.
    const tProf = await tokenDe(email('prof'));
    const tCoord = await tokenDe(email('coord'));
    const turma = (await chamar('POST', '/turmas', tProf, { nome: nome('7A'), serie: '7º Ano' })).json;
    const ana = (await chamar('POST', '/alunos', tProf, { turma_id: turma.id, nome: nome('Ana'), numero_chamada: 1 })).json;
    const bruno = (await chamar('POST', '/alunos', tProf, { turma_id: turma.id, nome: nome('Bruno'), numero_chamada: 2 })).json;
    const materia = (await chamar('POST', '/disciplinas', tProf, { nome: nome('Cien') })).json;
    await chamar('PUT', `/disciplinas/${materia.id}/turmas`, tProf, { turma_ids: [turma.id] });
    const prova = (await chamar('POST', '/tipos-avaliacao', tProf, { nome: 'P1', turma_id: turma.id, disciplina_id: materia.id, bimestre: 1 })).json;
    await chamar('PUT', '/notas', tProf, { notas: [{ aluno_id: ana.id, tipo_avaliacao_id: prova.id, nota: 8 }] });
    await chamar('POST', '/eventos-escola', tCoord, { titulo: nome('Conselho de classe'), data_inicio: '2026-11-20', tipo: 'conselho' });
    await chamar('POST', '/apoio-presencial', tCoord, { data: '2026-11-18', professor_id: prof.id, responsavel_id: coord.id });

    const lancamento = (aluno: string) => prisma.diario_lancamentos.findFirst({ where: { aluno_id: aluno } }).then((l) => l?.valor ?? null);

    await entrar(email('prof'));

    console.log('\n— Diário do professor —');
    await page.goto(`${front}/diario`);
    await page.getByRole('combobox').filter({ hasText: 'Selecione a turma' }).click();
    await page.getByRole('option', { name: nome('7A') }).click();
    await page.getByRole('button', { name: 'Nova Atividade' }).click();
    await page.getByPlaceholder('Ex: A1, Experimento sobre células...').fill('Experimento');
    await page.getByRole('button', { name: 'Criar atividade' }).click();
    const atividade = () => prisma.diario_atividades.findFirst({ where: { turma_id: turma.id } });
    check(await noBanco(atividade, (a) => a?.nome === 'Experimento' && a.user_id === prof.id && a.bimestre === 1), 'Nova atividade é gravada no diário do professor');

    const celula = (aluno: string) => page.locator('tr', { hasText: aluno }).locator('input[type=text]').first();
    await celula(nome('Ana')).waitFor();
    await celula(nome('Ana')).fill('8,5');
    await celula(nome('Ana')).blur();
    check(await noBanco(() => lancamento(ana.id), (v) => v === '8,5'), 'Escrever na célula grava o lançamento');

    await celula(nome('Ana')).focus();
    await celula(nome('Ana')).evaluate((el: HTMLInputElement) => {
      const dados = new DataTransfer();
      dados.setData('text/plain', 'MB\nB');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dados, bubbles: true, cancelable: true }));
    });
    check(await noBanco(async () => [await lancamento(ana.id), await lancamento(bruno.id)], ([a, b]) => a === 'MB' && b === 'B'),
      'Colar uma coluna grava os dois lançamentos (num pedido só)');

    await page.reload();
    await page.getByRole('combobox').filter({ hasText: 'Selecione a turma' }).click();
    await page.getByRole('option', { name: nome('7A') }).click();
    // Os lançamentos chegam depois das atividades: espera o valor salvo aparecer na célula.
    const comValor = page.locator('tr', { hasText: nome('Bruno') }).locator('input[value="B"]');
    check(await comValor.waitFor({ timeout: 15_000 }).then(() => true, () => false), 'Ao voltar, os lançamentos aparecem na planilha');
    await celula(nome('Bruno')).fill('');
    await celula(nome('Bruno')).blur();
    check(await noBanco(() => lancamento(bruno.id), (v) => v === null), 'Apagar a célula apaga o lançamento');

    console.log('\n— Agenda —');
    await page.goto(`${front}/agenda`);
    await page.getByRole('tab', { name: /configurar rotina/i }).click();
    await page.getByRole('combobox').filter({ hasText: 'Disciplina' }).first().click();
    await page.getByRole('option', { name: nome('Cien') }).click();
    const rotina = () => prisma.agenda_professor.findMany({ where: { user_id: prof.id } });
    check(await noBanco(rotina, (r) => r.length === 1 && r[0].disciplina_id === materia.id && r[0].dia_semana === 1), 'Escolher a matéria na rotina grava a aula de segunda');
    // Espera a tela recarregar a rotina (aparece o "limpar" na célula) antes de replicar.
    await page.getByRole('button', { name: 'limpar' }).first().waitFor();
    await page.getByRole('button', { name: 'Replicar segunda para a semana' }).click();
    check(await noBanco(rotina, (r) => r.length === 5 && r.every((x) => x.disciplina_id === materia.id)), '"Replicar segunda" copia para terça a sexta (num pedido só)');
    await page.getByRole('button', { name: 'limpar' }).first().click();
    check(await noBanco(rotina, (r) => r.length === 4), '"Limpar" tira a aula da rotina');

    await page.getByRole('tab', { name: /agenda da escola/i }).click();
    check(await visivel(nome('Conselho de classe')), 'A agenda da escola mostra o evento marcado pela gestão');
    await page.getByRole('tab', { name: /apoio presencial/i }).click();
    check(await visivel('Teste coord'), 'O apoio presencial mostra o nome do responsável (que o professor não teria como buscar)');

    console.log('\n— Lembretes —');
    await page.goto(`${front}/`);
    await page.getByRole('button', { name: /novo lembrete|criar primeiro lembrete/i }).first().click();
    await page.getByPlaceholder('Título do lembrete...').fill(nome('Levar as provas'));
    await page.getByRole('button', { name: 'Criar Lembrete' }).click();
    const lembrete = () => prisma.lembretes.findFirst({ where: { user_id: prof.id } });
    check(await noBanco(lembrete, (l) => l?.titulo === nome('Levar as provas')), 'Novo lembrete é gravado');
    await page.getByTitle('Concluir').first().click();
    check(await noBanco(lembrete, (l) => l?.concluido === true), 'Concluir o lembrete grava no banco');

    console.log('\n— Relatórios —');
    await page.goto(`${front}/relatorios`);
    const linhaAna = page.locator('tr', { hasText: nome('Ana') });
    await linhaAna.waitFor();
    check((await linhaAna.textContent())?.includes('8.00') === true && (await linhaAna.textContent())?.includes('Aprovado') === true,
      'O relatório mostra a média da aluna (8,00) e a situação');
    await sair();

    console.log('\n— Painel da gestão —');
    await entrar(email('coord'));
    await page.goto(`${front}/gestao`);
    check(await visivel('Painel da Gestão'), 'A coordenação abre o painel da gestão');
    check(await page.locator(':text-is("Professores"):visible').first().waitFor({ timeout: 15_000 }).then(() => true, () => false), 'Com os números da escola');
  } catch (err) {
    erro = err;
  }
  await fechar(async () => {
    await prisma.agenda_escola_eventos.deleteMany({ where: { titulo: { startsWith: PREFIXO } } });
    await prisma.tipos_avaliacao.deleteMany({ where: { user_id: { in: ids } } });
    await prisma.disciplinas.deleteMany({ where: { user_id: { in: ids } } });
    const t = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    console.log(`\n🧹 Evento, avaliações, matéria e ${t.count} turma(s) de teste apagadas (agenda, lembretes e apoio saem com os usuários).`);
  }, erro);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
