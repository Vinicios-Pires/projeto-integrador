/**
 * Conferência da Fase 6, Parte 1: as telas de login ligadas ao backend, num navegador de verdade.
 * Cria usuários de teste temporários (e-mails `teste-tela-login-*`), sobe a API e o frontend (Vite)
 * em portas livres, usa o Chromium do Playwright (instalado no frontend) e apaga tudo no final.
 * Não toca no admin real.
 *
 * Uso: npm run test:tela-login   (precisa do `npm install` no frontend)
 */
import { abrirTelas, check, SENHA } from './telas';

const PREFIXO = `teste-tela-login-${Date.now()}`;
const NOVA_SENHA = 'SenhaNovaDoTeste456';

async function main() {
  const tela = await abrirTelas(PREFIXO);
  const { api, front, page, prisma, email, criarUsuario, visivel, naTela, fechar } = tela;
  // Aqui o login às vezes deve falhar: não espera sair da tela de entrar.
  const entrar = (e: string, senha: string) => tela.entrar(e, senha, { esperar: false });
  const tokenSalvo = () => page.evaluate(() => localStorage.getItem('painel.token'));

  try {
    await criarUsuario('admin', { roles: ['admin'] });
    const prof = await criarUsuario('prof');
    await criarUsuario('pendente', { status: 'pendente' });

    console.log('\n— CORS (a API aceita o frontend) —');
    const preflight = await fetch(`${api}/me`, {
      method: 'OPTIONS',
      headers: { Origin: front, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' },
    });
    check(
      preflight.status === 204 &&
        preflight.headers.get('access-control-allow-origin') === front &&
        /authorization/i.test(preflight.headers.get('access-control-allow-headers') ?? ''),
      'Consulta prévia do navegador, vinda do frontend, é liberada (204, com Authorization)',
    );
    const deFora = await fetch(`${api}/health`, { headers: { Origin: 'https://site-estranho.example' } });
    check(!deFora.headers.get('access-control-allow-origin'), 'Outro site não recebe a liberação');
    const preflightFora = await fetch(`${api}/me`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://site-estranho.example', 'Access-Control-Request-Method': 'GET' },
    });
    check(!preflightFora.headers.get('access-control-allow-origin'), 'Nem na consulta prévia');

    console.log('\n— Entrar —');
    await page.goto(`${front}/`);
    check(await naTela('/login'), 'Sem login, o sistema manda para a tela de entrar');

    await entrar(email('prof'), 'senha-errada');
    check(await visivel('E-mail ou senha incorretos.'), 'Senha errada mostra a mensagem do backend');
    check(new URL(page.url()).pathname === '/login' && !(await tokenSalvo()), 'Continua no login, sem guardar nada');

    await entrar(email('pendente'), SENHA);
    check(await visivel('Seu cadastro ainda está aguardando aprovação.'), 'Conta pendente: avisa que aguarda aprovação');

    await entrar(email('prof'), SENHA);
    check(await naTela('/'), 'Login certo leva ao painel');
    check(await visivel('Teste prof'), 'O nome do professor aparece no menu');
    check(!!(await tokenSalvo()), 'O login fica guardado no navegador');

    await page.reload();
    check(await visivel('Teste prof'), 'Recarregar a página mantém o login');

    await page.getByRole('button', { name: /sair/i }).first().click();
    check(await naTela('/login'), 'Sair volta para a tela de entrar');
    check(!(await tokenSalvo()), 'E apaga o login guardado');

    await page.evaluate(() => localStorage.setItem('painel.token', 'token-invalido'));
    await page.goto(`${front}/`);
    check(await naTela('/login'), 'Login inválido ou vencido: volta para a tela de entrar');
    check(!(await tokenSalvo()), 'E o login inválido é apagado');

    console.log('\n— Criar conta —');
    await page.goto(`${front}/cadastro`);
    await page.fill('#nome', 'Teste cadastro');
    await page.fill('#email', `${PREFIXO}-cadastro@gmail.com`);
    await page.fill('#password', SENHA);
    await page.click('button[type=submit]');
    check(await visivel('Domínio não permitido'), 'E-mail de fora do domínio é recusado na tela');

    await page.fill('#email', email('cadastro'));
    await page.fill('#password', 'curta12');
    await page.locator('#password').evaluate((el: HTMLInputElement) => el.removeAttribute('minlength'));
    await page.click('button[type=submit]');
    check(await visivel('A senha deve ter pelo menos 8 caracteres.'), 'Senha com menos de 8 caracteres é recusada');

    await page.fill('#password', SENHA);
    await page.click('button[type=submit]');
    check(await visivel('Cadastro recebido'), 'Cadastro certo mostra "Cadastro recebido"');
    const novo = await prisma.usuarios.findUnique({ where: { email: email('cadastro') }, include: { profile: true } });
    check(novo?.profile?.status === 'pendente' && novo.profile.nome === 'Teste cadastro', 'A conta foi criada no banco, pendente');

    console.log('\n— Gerenciar usuários (admin) —');
    await entrar(email('admin'), SENHA);
    await page.waitForURL((u: URL) => u.pathname !== '/login');
    await page.goto(`${front}/usuarios`);
    const linhaCadastro = page.locator('div.p-3.border.rounded-lg', { hasText: email('cadastro') });
    check(await visivel(email('cadastro')), 'O admin vê o cadastro novo na lista');
    check((await linhaCadastro.getByText('pendente', { exact: true }).count()) === 1, 'Ele aparece como pendente');
    await linhaCadastro.getByRole('button', { name: 'Ativar', exact: true }).click();
    check(await visivel('Status atualizado'), 'Ativar mostra a confirmação');
    const ativado = await prisma.profiles.findUnique({ where: { id: novo!.id } });
    check(ativado?.status === 'ativo', 'E a conta fica ativa no banco');

    await page.locator('div.p-3.border.rounded-lg', { hasText: email('prof') }).getByRole('button', { name: /resetar senha/i }).click();
    check(await visivel('Senha temporária'), 'Resetar senha abre a senha temporária');
    const senhaTemp = (await page.locator('code').first().textContent())?.trim() ?? '';
    check(senhaTemp.length >= 8, 'A senha temporária aparece na tela');
    await page.getByRole('button', { name: 'Pronto' }).click();
    await page.getByRole('button', { name: /sair/i }).first().click();
    await naTela('/login');

    console.log('\n— Senha temporária: troca obrigatória —');
    await entrar(email('prof'), senhaTemp);
    check(await visivel('Crie uma senha nova'), 'Com a senha temporária, o sistema pede uma senha nova');
    check(!(await page.getByText('Teste prof').count()), 'E não mostra o painel antes da troca');

    await page.fill('#senha-atual', 'nao-e-esta');
    await page.fill('#password', NOVA_SENHA);
    await page.fill('#confirmacao', NOVA_SENHA);
    await page.click('button[type=submit]');
    check(await visivel('A senha atual está incorreta.'), 'Senha temporária errada é recusada');

    await page.fill('#senha-atual', senhaTemp);
    await page.fill('#confirmacao', 'outra-coisa-qualquer');
    await page.click('button[type=submit]');
    check(await visivel('As senhas não conferem'), 'As duas senhas novas precisam ser iguais');

    await page.fill('#confirmacao', NOVA_SENHA);
    await page.click('button[type=submit]');
    check(await visivel('Teste prof'), 'Depois da troca, o painel abre');
    const trocado = await prisma.usuarios.findUnique({ where: { id: prof.id } });
    check(trocado?.deve_trocar_senha === false, 'No banco, a troca obrigatória foi liberada');

    console.log('\n— Trocar a senha por vontade própria —');
    await page.goto(`${front}/configuracoes`);
    await page.getByRole('link', { name: /trocar senha/i }).click();
    check(await naTela('/redefinir-senha') && (await visivel('Informe a senha atual e escolha uma nova')), 'Configurações leva à troca de senha');
    await page.fill('#senha-atual', NOVA_SENHA);
    await page.fill('#password', SENHA);
    await page.fill('#confirmacao', SENHA);
    await page.click('button[type=submit]');
    check(await visivel('Senha atualizada'), 'A troca mostra a confirmação');
    const login = await fetch(`${api}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email('prof'), senha: SENHA }),
    });
    check(login.status === 200, 'A senha nova passa a valer');

    console.log('\n— Esqueci minha senha —');
    await page.getByRole('button', { name: /sair/i }).first().click();
    await naTela('/login');
    await page.getByRole('link', { name: /esqueci minha senha/i }).click();
    check(await visivel('resetar a sua senha'), 'A tela explica como pedir a senha temporária ao administrador');
    await fechar();
  } catch (err) {
    await fechar(undefined, err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
