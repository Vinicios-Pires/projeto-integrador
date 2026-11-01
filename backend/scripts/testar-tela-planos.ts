/**
 * Conferência da Fase 6, Parte 4: a tela de Plano de Aula (planejamento bimestral em planilha, aulas,
 * ajustes, anexos e validação pela gestão) ligada ao backend, num navegador de verdade. Cria usuários e
 * dados de teste (prefixo `teste-tela-planos-*`), confere no banco e apaga tudo no final (os anexos ficam
 * numa pasta temporária).
 *
 * Uso: npm run test:tela-planos   (precisa do `npm install` no frontend)
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { abrirTelas, check } from './telas';

const PREFIXO = `teste-tela-planos-${Date.now()}`;
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
  const { front, page, prisma, pastaArquivos, email, criarUsuario, visivel, entrar, sair, tokenDe, chamar, fechar } = tela;
  const ids: string[] = [];
  let erro: unknown;

  try {
    const prof = await criarUsuario('prof');
    const coord = await criarUsuario('coord', { roles: ['coordenador'] });
    ids.push(prof.id, coord.id);

    const tProf = await tokenDe(email('prof'));
    const turma = (await chamar('POST', '/turmas', tProf, { nome: nome('9A'), serie: '9º Ano' })).json;
    const materia = (await chamar('POST', '/disciplinas', tProf, { nome: nome('Hist') })).json;

    const aulas = () => prisma.planos_aula.findMany({ where: { turma_id: turma.id }, orderBy: [{ data_aula: 'asc' }, { created_at: 'asc' }] });
    const linhaDaTabela = (i: number) => page.locator('tbody tr').nth(i);
    const menuDaLinha = async (i: number, item: string | RegExp) => {
      await linhaDaTabela(i).locator('td').last().getByRole('button').click();
      await page.getByRole('menuitem', { name: item }).click();
    };

    await entrar(email('prof'));

    console.log('\n— Planejamento —');
    await page.goto(`${front}/plano-aula`);
    await page.getByRole('button', { name: /novo planejamento bimestral/i }).click();
    await page.getByRole('combobox').filter({ hasText: 'Selecione a disciplina' }).click();
    await page.getByRole('option', { name: nome('Hist') }).click();
    await page.getByRole('combobox').filter({ hasText: 'Selecione a turma' }).click();
    await page.getByRole('option', { name: nome('9A') }).click();
    await page.getByRole('button', { name: 'Criar e abrir planilha' }).click();
    check(await visivel('Adicionar aula'), 'Criar o planejamento abre a planilha');
    const planejamento = await prisma.planejamentos_bimestrais.findFirst({ where: { turma_id: turma.id } });
    check(planejamento?.user_id === prof.id && planejamento.disciplina_id === materia.id && planejamento.status === 'rascunho' && planejamento.bimestre === 1,
      'O planejamento é gravado como rascunho, no nome do professor');

    console.log('\n— Aulas —');
    await page.getByRole('button', { name: /datas em sequência/i }).click();
    const seq = page.getByRole('dialog');
    await seq.locator('input[type=date]').first().fill('2026-03-02');
    await seq.locator('input[type=date]').last().fill('2026-03-13');
    await seq.getByRole('button', { name: 'Criar aulas' }).click();
    check(await visivel('4 aulas adicionadas'), 'Datas em sequência (segundas e quartas, 2 semanas) cria 4 aulas');
    let lista = await aulas();
    check(lista.length === 4 && lista.every((a) => a.planejamento_id === planejamento!.id && a.disciplina_id === materia.id && a.user_id === prof.id && a.dia_semana !== null),
      'As aulas entram no planejamento, com a matéria e o dia da semana');

    await page.getByRole('button', { name: 'Adicionar aula' }).click();
    check(await noBanco(aulas, (l) => l.length === 5), '"Adicionar aula" cria mais uma');
    // A tela recarrega a lista depois de criar: espera a linha nova aparecer antes de editar.
    await page.locator('tbody tr').nth(4).waitFor();

    const conteudo = linhaDaTabela(0).locator('td').nth(4);
    await conteudo.click();
    await conteudo.locator('textarea').fill('Revolução Industrial');
    await conteudo.locator('textarea').blur();
    check(await noBanco(aulas, (l) => l[0].conteudo === 'Revolução Industrial'), 'Escrever na célula grava o conteúdo da aula');

    await menuDaLinha(0, /copiar conteúdo\/objetivo/i);
    check(await noBanco(aulas, (l) => l.every((a) => a.conteudo === 'Revolução Industrial')), '"Copiar para baixo" leva o conteúdo para as aulas seguintes');

    await menuDaLinha(0, /duplicar/i);
    check(await noBanco(aulas, (l) => l.length === 6 && l.some((a) => a.duplicado_de === l[0].id)), 'Duplicar cria a cópia (na semana seguinte)');

    await menuDaLinha(0, /ajustar/i);
    await page.getByPlaceholder('O que foi ajustado nesta aula…').fill('Troquei o vídeo por um texto');
    await page.getByRole('button', { name: 'Registrar ajuste' }).click();
    check(await visivel('Ajuste registrado'), 'Registrar um ajuste (PDCA) mostra a confirmação');
    lista = await aulas();
    check((await prisma.ajustes_plano.count({ where: { plano_id: lista[0].id } })) === 1, 'E o ajuste é gravado na aula');

    console.log('\n— Anexos —');
    await linhaDaTabela(0).getByRole('button', { name: /documento/i }).click();
    await page.locator('input[type=file]').first().setInputFiles({ name: 'roteiro.txt', mimeType: 'text/plain', buffer: Buffer.from('Roteiro da aula') });
    const anexo = () => prisma.plano_anexos.findFirst({ where: { plano_id: lista[0].id } });
    check(await noBanco(anexo, (a) => a?.nome_arquivo === 'roteiro.txt' && a.tipo === 'documento' && a.storage_path.startsWith(`${prof.id}/`)),
      'Anexar um arquivo grava o anexo, na pasta do professor');
    const a1 = await anexo();
    check(existsSync(path.join(pastaArquivos, 'plano-anexos', a1!.storage_path)), 'E o arquivo fica guardado no armazenamento');
    await visivel('roteiro.txt');
    const [aba] = await Promise.all([page.waitForEvent('popup'), page.getByTitle('Baixar').first().click()]);
    await aba.waitForLoadState();
    check((await aba.textContent('body'))?.includes('Roteiro da aula') === true, '"Baixar" abre o arquivo por um link temporário');
    await aba.close();
    await page.getByTitle('Remover').first().click();
    check(await noBanco(anexo, (a) => a === null), 'Remover tira o anexo do banco');
    check(!existsSync(path.join(pastaArquivos, 'plano-anexos', a1!.storage_path)), 'E apaga o arquivo');
    await page.keyboard.press('Escape');

    await menuDaLinha(5, /excluir/i);
    check(await noBanco(aulas, (l) => l.length === 5), 'Excluir uma aula tira ela do banco');

    console.log('\n— Validação —');
    await page.getByRole('button', { name: /enviar para validação/i }).click();
    check(await noBanco(() => prisma.planejamentos_bimestrais.findUnique({ where: { id: planejamento!.id } }), (p) => p?.status === 'aguardando_validacao'),
      'Enviar para validação muda a situação no banco');
    await page.goto(`${front}/plano-aula`);
    check(await visivel('5 aulas'), 'A lista de planejamentos mostra quantas aulas ele tem');
    await sair();

    await entrar(email('coord'));
    await page.goto(`${front}/plano-aula`);
    await page.locator('div.cursor-pointer', { hasText: nome('Hist') }).first().click();
    await page.getByRole('button', { name: /validar planejamento/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
    check(await noBanco(() => prisma.planejamentos_bimestrais.findUnique({ where: { id: planejamento!.id } }), (p) => p?.status === 'validado' && p.validado_por === coord.id),
      'A coordenação valida: grava a situação e quem validou');
    await sair();

    await entrar(email('prof'));
    await page.goto(`${front}/plano-aula`);
    await page.locator('div.cursor-pointer', { hasText: nome('Hist') }).first().click();
    await visivel('Revolução Industrial');
    check((await page.getByRole('button', { name: 'Adicionar aula' }).count()) === 0, 'Depois de validado, a planilha fica só para leitura');
  } catch (err) {
    erro = err;
  }
  await fechar(async () => {
    // Apagar as turmas leva planejamentos, aulas, ajustes e anexos.
    await prisma.disciplinas.deleteMany({ where: { user_id: { in: ids } } });
    const t = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    console.log(`\n🧹 ${t.count} turma(s) de teste (com planejamento, aulas e anexos) apagadas.`);
  }, erro);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
