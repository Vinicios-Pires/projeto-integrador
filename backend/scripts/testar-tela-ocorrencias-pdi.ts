/**
 * Conferência da Fase 6, Parte 6: Ocorrências (notebook e escolares), PDI, Tutoria e Replicabilidade ligadas ao
 * backend, num navegador de verdade, com fotos e documentos pelo correio de arquivos. Cria usuários e dados de
 * teste (prefixo `teste-tela-ocorr-*`), confere no banco e no armazenamento (pasta temporária) e apaga tudo.
 *
 * Uso: npm run test:tela-ocorrencias-pdi   (precisa do `npm install` no frontend)
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { abrirTelas, check } from './telas';

const PREFIXO = `teste-tela-ocorr-${Date.now()}`;
const nome = (n: string) => `${PREFIXO}-${n}`;
// Uma imagem PNG de 1×1 pixel, para as fotos.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const foto = (n: string) => ({ name: `${n}.png`, mimeType: 'image/png', buffer: PNG });
const texto = (n: string) => ({ name: `${n}.txt`, mimeType: 'text/plain', buffer: Buffer.from(`Documento ${n}`) });

async function noBanco<T>(ler: () => Promise<T>, ok: (v: T) => boolean, ms = 15_000): Promise<boolean> {
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
  const guardado = (bucket: string, p: string) => existsSync(path.join(pastaArquivos, bucket, p));
  const ids: string[] = [];
  let erro: unknown;

  try {
    const prof = await criarUsuario('prof');
    const coord = await criarUsuario('coord', { roles: ['coordenador'] });
    ids.push(prof.id, coord.id);

    const tProf = await tokenDe(email('prof'));
    const turma = (await chamar('POST', '/turmas', tProf, { nome: nome('8A'), serie: '8º Ano' })).json;
    const ana = (await chamar('POST', '/alunos', tProf, { turma_id: turma.id, nome: nome('Ana'), numero_chamada: 1 })).json;
    const materia = (await chamar('POST', '/disciplinas', tProf, { nome: nome('Geo') })).json;
    await chamar('PUT', `/disciplinas/${materia.id}/turmas`, tProf, { turma_ids: [turma.id] });

    await entrar(email('prof'));

    console.log('\n— Ocorrências do notebook —');
    await page.goto(`${front}/ocorrencias`);
    await page.getByRole('button', { name: 'Nova Ocorrência' }).click();
    await page.getByPlaceholder('Sem internet, travando...').fill(nome('Sem internet'));
    await page.locator('input[type=file]').first().setInputFiles(foto('notebook'));
    await page.getByRole('button', { name: 'Salvar' }).click();
    const notebook = () => prisma.ocorrencias_notebook.findFirst({ where: { user_id: prof.id }, include: { fotos: true } });
    check(await noBanco(notebook, (o) => o?.problema_encontrado === nome('Sem internet') && o.fotos.length === 1),
      'Registrar a ocorrência com uma foto grava as duas coisas');
    const fotoNotebook = (await notebook())!.fotos[0];
    check(fotoNotebook.path.startsWith(`${prof.id}/`) && guardado('ocorrencias-fotos', fotoNotebook.path), 'A foto fica na pasta do professor, no armazenamento');
    check(await page.locator(`img[src*="/files/link/"]`).first().waitFor({ timeout: 15_000 }).then(() => true, () => false),
      'A foto aparece na tela por um link temporário');

    console.log('\n— Ocorrências escolares —');
    await page.goto(`${front}/ocorrencias-escolares`);
    await page.getByRole('button', { name: 'Nova Ocorrência' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByRole('combobox').nth(0).click();
    await page.getByRole('option', { name: nome('8A') }).click();
    await dlg.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: nome('Geo') }).click();
    await dlg.getByPlaceholder('Nomes separados por vírgula').fill(nome('Ana'));
    await dlg.getByPlaceholder('Relate o ocorrido...').fill(nome('Conversa durante a prova'));
    await dlg.getByRole('button', { name: 'Enviar ocorrência' }).click();
    check(await visivel('Ocorrência enviada para a gestão'), 'Enviar a ocorrência mostra a confirmação');
    const escolar = () => prisma.ocorrencias_escolares.findFirst({ where: { user_id: prof.id } });
    check(await noBanco(escolar, (o) => o?.status === 'nova' && o.turma === nome('8A') && o.disciplina === nome('Geo')),
      'Ela é gravada como "nova", com a turma e a matéria');

    console.log('\n— PDI —');
    await page.goto(`${front}/pdi-evidencias`);
    await page.getByRole('button', { name: /nova evidência/i }).first().click();
    await page.getByPlaceholder('Ex.: Jogo de Tabuleiro – Pilhas e Baterias').fill(nome('Feira de ciências'));
    const arquivos = page.getByRole('dialog').locator('input[type=file]');
    await arquivos.nth(0).setInputFiles(foto('pdi'));
    await arquivos.nth(2).setInputFiles(texto('relatorio'));
    await page.getByRole('button', { name: 'Salvar evidência' }).click();
    const evidencia = () => prisma.pdi_evidencias.findFirst({ where: { user_id: prof.id }, include: { fotos: true, documentos: true } });
    check(await noBanco(evidencia, (e) => e?.titulo === nome('Feira de ciências') && e.fotos.length === 1 && e.documentos.length === 1),
      'A evidência é gravada com a foto e o documento');
    const ev = (await evidencia())!;
    check(guardado('pdi-fotos', ev.fotos[0].storage_path) && guardado('pdi-documentos', ev.documentos[0].storage_path),
      'Os dois arquivos ficam no armazenamento');

    console.log('\n— Tutoria —');
    await page.goto(`${front}/tutoria`);
    await page.getByRole('button', { name: /adicionar tutorado/i }).click();
    await page.getByPlaceholder('Buscar por nome').fill(nome('Ana'));
    await page.locator('label', { hasText: nome('Ana') }).click();
    await page.getByRole('button', { name: /^Salvar/ }).first().click();
    check(await visivel('1 tutorado(s) vinculado(s)'), 'Vincular a aluna mostra a confirmação');
    const tutorado = () => prisma.tutorados.findFirst({ where: { user_id: prof.id }, include: { documentos: true } });
    check(await noBanco(tutorado, (t) => t?.aluno_id === ana.id && t.nome === nome('Ana') && t.turma === nome('8A')),
      'O tutorado é gravado com os dados do cadastro da aluna');
    await page.getByRole('button', { name: /abrir prontuário/i }).first().click();
    await page.getByRole('tab', { name: 'Documentos' }).click();
    await page.getByRole('dialog').locator('input[type=file]').last().setInputFiles(texto('combinados'));
    check(await noBanco(tutorado, (t) => t?.documentos.length === 1 && guardado('tutoria-documentos', t.documentos[0].storage_path)),
      'Anexar um documento no prontuário grava e guarda o arquivo');
    await page.keyboard.press('Escape');

    console.log('\n— Replicabilidade —');
    await page.goto(`${front}/replicabilidade`);
    await page.getByRole('button', { name: /nova replicabilidade/i }).first().click();
    await page.locator('#replicabilidade-titulo').fill(nome('Leitura em estações'));
    await page.getByRole('dialog').locator('input[type=file]').first().setInputFiles(foto('mural'));
    await page.getByRole('button', { name: 'Salvar Replicabilidade' }).click();
    const publicacao = () => prisma.replicabilidades.findFirst({ where: { user_id: prof.id }, include: { fotos: true } });
    check(await noBanco(publicacao, (r) => r?.titulo === nome('Leitura em estações') && r.fotos.length === 1),
      'Publicar no mural grava a publicação com a foto');
    await sair();

    console.log('\n— Gestão —');
    await entrar(email('coord'));
    await page.goto(`${front}/ocorrencias-escolares`);
    check(await visivel(nome('Conversa durante a prova')), 'A coordenação vê a ocorrência escolar do professor');
    await page.goto(`${front}/replicabilidade`);
    check(await visivel(nome('Leitura em estações')) && (await visivel('Teste prof')), 'O mural mostra a publicação com o nome de quem publicou');
  } catch (err) {
    erro = err;
  }
  // Ocorrências, evidências, tutorados e publicações saem com os usuários; os arquivos, com a pasta temporária.
  await fechar(async () => {
    await prisma.disciplinas.deleteMany({ where: { user_id: { in: ids } } });
    const t = await prisma.turmas.deleteMany({ where: { OR: [{ user_id: { in: ids } }, { nome: { startsWith: PREFIXO } }] } });
    console.log(`\n🧹 Matéria e ${t.count} turma(s) de teste apagadas.`);
  }, erro);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
