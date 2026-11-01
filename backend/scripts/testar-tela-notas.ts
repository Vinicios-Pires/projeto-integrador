/**
 * Conferência da Fase 6, Parte 3: as telas de Notas (com médias arredondadas), Correção de Provas e
 * Prova Paulista ligadas ao backend, num navegador de verdade. Cria usuários e dados de teste (prefixo
 * `teste-tela-notas-*`), usa as telas como uma pessoa faria, confere no banco e apaga tudo no final.
 *
 * Uso: npm run test:tela-notas   (precisa do `npm install` no frontend)
 */
import { abrirTelas, check } from './telas';

const PREFIXO = `teste-tela-notas-${Date.now()}`;
const nome = (n: string) => `${PREFIXO}-${n}`;

/** Espera uma condição no banco (as telas gravam sem bloquear a digitação). */
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

    // Dados de partida, pela API: turma com dois alunos e uma matéria ligada a ela.
    const tProf = await tokenDe(email('prof'));
    const turma = (await chamar('POST', '/turmas', tProf, { nome: nome('8A'), serie: '8º Ano' })).json;
    const ana = (await chamar('POST', '/alunos', tProf, { turma_id: turma.id, nome: nome('Ana'), numero_chamada: 1 })).json;
    const bruno = (await chamar('POST', '/alunos', tProf, { turma_id: turma.id, nome: nome('Bruno'), numero_chamada: 2 })).json;
    const materia = (await chamar('POST', '/disciplinas', tProf, { nome: nome('Mat') })).json;
    await chamar('PUT', `/disciplinas/${materia.id}/turmas`, tProf, { turma_ids: [turma.id] });

    const nota = (aluno: string, tipo: string) =>
      prisma.notas.findFirst({ where: { aluno_id: aluno, tipo_avaliacao_id: tipo } }).then((n) => (n ? Number(n.nota) : null));
    const linha = (texto: string) => page.locator('tr', { hasText: texto });

    await entrar(email('prof'));

    console.log('\n— Notas —');
    await page.goto(`${front}/notas`);
    check(await visivel(nome('Ana')), 'A planilha abre com a turma e a matéria do professor, e os alunos');

    const novaAvaliacao = async (titulo: string, peso: string, paulista = false) => {
      await page.getByRole('button', { name: 'Nova Avaliação' }).click();
      const dialogo = page.getByRole('dialog');
      await dialogo.getByPlaceholder('Ex: Prova, Trabalho, Projeto, Participação...').fill(titulo);
      await dialogo.getByPlaceholder('Ex: 1, 2, 0,5 ou 25%').fill(peso);
      if (paulista) await dialogo.locator('input[type=checkbox]').check();
      await dialogo.getByRole('button', { name: 'Adicionar' }).click();
    };
    await novaAvaliacao('Prova 1', '2', true);
    check(await visivel('Avaliação adicionada!'), 'Nova avaliação mostra a confirmação');
    const prova1 = await prisma.tipos_avaliacao.findFirst({ where: { turma_id: turma.id, nome: 'Prova 1' } });
    check(Number(prova1?.peso) === 2 && prova1?.categoria === 'prova_paulista' && prova1.user_id === prof.id && prova1.bimestre === 1,
      'Ela é gravada com o peso, a marca de Prova Paulista e o bimestre');
    await novaAvaliacao('Trabalho', '1');
    await visivel('Trabalho');
    const trabalho = await prisma.tipos_avaliacao.findFirst({ where: { turma_id: turma.id, nome: 'Trabalho' } });
    check(trabalho?.ordem === 2, 'A segunda avaliação vai para o fim da planilha');

    const celula = (aluno: string, coluna: number) => linha(aluno).locator('input[placeholder="—"]').nth(coluna);
    await celula(nome('Ana'), 0).fill('8');
    await celula(nome('Ana'), 0).press('Tab');
    check(await noBanco(() => nota(ana.id, prova1!.id), (n) => n === 8), 'Digitar uma nota grava no banco');

    // Colar uma coluna (como do Excel): 6 para a Ana e 9 para o Bruno, no Trabalho.
    await celula(nome('Ana'), 1).focus();
    await celula(nome('Ana'), 1).evaluate((el: HTMLInputElement) => {
      const dados = new DataTransfer();
      dados.setData('text/plain', '6\n9');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dados, bubbles: true, cancelable: true }));
    });
    check(await visivel('2 nota(s) colada(s) com sucesso!'), 'Colar uma coluna de notas mostra a confirmação');
    check(await noBanco(async () => [await nota(ana.id, trabalho!.id), await nota(bruno.id, trabalho!.id)], ([a, b]) => a === 6 && b === 9),
      'E as duas notas são gravadas (num pedido só)');
    check(await linha(nome('Ana')).getByText('7.33').first().isVisible(), 'A média ponderada aparece: (8×2 + 6×1) ÷ 3 = 7,33');

    await celula(nome('Bruno'), 1).fill('');
    await celula(nome('Bruno'), 1).press('Tab');
    check(await noBanco(() => nota(bruno.id, trabalho!.id), (n) => n === null), 'Apagar a nota da célula apaga no banco');

    console.log('\n— Médias arredondadas —');
    const media = linha(nome('Ana')).locator('input[title^="Calculado"], input[title^="Editado"]');
    await media.fill('8');
    await media.press('Enter');
    const ajuste = () => prisma.medias_arredondadas.findFirst({ where: { aluno_id: ana.id, disciplina_id: materia.id, bimestre: 1 } });
    check(await noBanco(ajuste, (m) => Number(m?.nota_arredondada) === 8 && m?.manual === true && m.user_id === prof.id),
      'Ajustar a média final à mão grava no banco (marcada como manual)');
    await page.reload();
    await visivel(nome('Ana'));
    check(await media.inputValue().then((v) => v === '8') && (await media.getAttribute('title'))?.startsWith('Editado') === true,
      'Ao recarregar, a média ajustada continua lá, marcada como manual');
    await media.fill('');
    await media.press('Enter');
    check(await noBanco(ajuste, (m) => m === null), 'Apagar o ajuste volta ao cálculo automático (sai do banco)');

    console.log('\n— Correção de provas —');
    await page.goto(`${front}/correcao-provas`);
    await page.getByRole('button', { name: 'Nova Prova' }).click();
    const dialogo = page.getByRole('dialog');
    await dialogo.getByPlaceholder('Ex: Prova Bimestral de Matemática').fill(nome('Prova bimestral'));
    await dialogo.getByRole('combobox').filter({ hasText: 'Selecione' }).first().click();
    await page.getByRole('option', { name: nome('8A') }).click();
    await dialogo.getByRole('combobox').filter({ hasText: 'Selecione' }).first().click();
    await page.getByRole('option', { name: nome('Mat') }).click();
    await dialogo.getByRole('button', { name: 'Criar Prova' }).click();
    check(await visivel('Prova criada!'), 'Nova prova mostra a confirmação');
    const prova = await prisma.provas.findFirst({ where: { titulo: nome('Prova bimestral') } });
    check(prova?.turma_id === turma.id && prova.disciplina_id === materia.id && prova.numero_questoes === 10 && Number(prova.valor_total) === 10,
      'Ela é gravada com a turma, a matéria, 10 questões e valor 10');

    // Gabarito: todas "A" (o padrão da tela), com a questão 10 anulada.
    await page.getByTitle('Anular questão').last().click();
    await page.getByRole('button', { name: 'Salvar Gabarito' }).click();
    check(await visivel('Gabarito salvo com sucesso!'), 'Salvar o gabarito mostra a confirmação');
    const gabarito = await prisma.gabaritos.findMany({ where: { prova_id: prova!.id }, orderBy: { numero_questao: 'asc' } });
    check(gabarito.length === 10 && gabarito[9].anulada && gabarito.every((g) => g.resposta_correta === 'A'), 'O gabarito inteiro é gravado, com a questão anulada');

    // Folha da Ana digitada à mão: acerta as questões 1 a 4 (mais a anulada) = 5 de 10.
    await page.getByRole('button', { name: /escanear folha/i }).first().click();
    await page.getByRole('button', { name: /entrada manual/i }).click();
    const scan = page.getByRole('dialog');
    await scan.getByRole('combobox').filter({ hasText: 'Selecione a prova' }).click();
    await page.getByRole('option', { name: nome('Prova bimestral') }).click();
    await scan.getByPlaceholder('Ex: 15').fill('1');
    for (let i = 0; i < 4; i++) await scan.getByRole('button', { name: 'A', exact: true }).nth(i).click();
    await scan.getByRole('button', { name: 'Confirmar e Salvar Nota' }).click();
    check(await visivel('Nota 5.0 lançada!'), 'Lançar a folha mostra a nota calculada pelo backend');
    const resultado = () => prisma.resultados_prova.findFirst({ where: { prova_id: prova!.id, aluno_id: ana.id } });
    check(await noBanco(resultado, (r) => r?.acertos === 5 && Number(r.nota) === 5 && r.ajuste_manual === false), 'A folha é gravada: 5 acertos, nota 5');
    check(await visivel(`Nota 5.0 lançada para ${nome('Ana')}`), 'A tela de "resultado salvo" mostra a nota certa');
    await scan.getByRole('button', { name: 'Concluir' }).click();

    // Trocar a resposta da questão 1 no gabarito recorrige a folha já lançada.
    await page.getByRole('button', { name: 'B', exact: true }).first().click();
    await page.getByRole('button', { name: 'Salvar Gabarito' }).click();
    check(await noBanco(resultado, (r) => r?.acertos === 4 && Number(r.nota) === 4), 'Mudar o gabarito recalcula a nota da folha (4 acertos)');

    console.log('\n— Prova Paulista —');
    await page.goto(`${front}/prova-paulista`);
    check(await visivel(nome('Ana')), 'O painel da Prova Paulista mostra a aluna com nota de Prova Paulista');
    await sair();

    console.log('\n— Gestão —');
    await entrar(email('coord'));
    await page.goto(`${front}/notas`);
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: nome('8A') }).click();
    check(await visivel(nome('Ana')), 'A coordenação abre a planilha da turma do professor');
    check((await celula(nome('Ana'), 0).inputValue()) === '8', 'E vê as notas lançadas');
    await page.goto(`${front}/correcao-provas`);
    check(await visivel(nome('Prova bimestral')), 'A coordenação vê a prova do professor');
  } catch (err) {
    erro = err;
  }
  await fechar(async () => {
    await prisma.provas.deleteMany({ where: { user_id: { in: ids } } });
    await prisma.tipos_avaliacao.deleteMany({ where: { user_id: { in: ids } } });
    await prisma.medias_arredondadas.deleteMany({ where: { user_id: { in: ids } } });
    await prisma.disciplinas.deleteMany({ where: { user_id: { in: ids } } });
    const t = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    console.log(`\n🧹 Provas, avaliações, notas, matérias e ${t.count} turma(s) de teste apagadas.`);
  }, erro);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
