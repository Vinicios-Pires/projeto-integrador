/**
 * Conferência do banco (Fase 0): estrutura criada, regras ativas e dados iniciais.
 * Não altera nada de forma permanente — os testes de regra rodam dentro de
 * transações desfeitas ao final.
 *
 * Uso: npm run db:check
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { verifyPassword } from '../src/lib/password';

const prisma = new PrismaClient();
let falhas = 0;

function check(ok: boolean, descricao: string) {
  console.log(`${ok ? '✅' : '❌'} ${descricao}`);
  if (!ok) falhas++;
}

/** Executa `fn` numa transação que é sempre desfeita; retorna true se o banco recusou. */
async function bancoRecusa(fn: (tx: PrismaClient) => Promise<unknown>): Promise<boolean> {
  const ROLLBACK = Symbol('rollback');
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx as PrismaClient);
      throw ROLLBACK;
    });
    return false;
  } catch (err) {
    return err !== ROLLBACK;
  }
}

async function main() {
  const [{ tabelas }] = await prisma.$queryRaw<{ tabelas: number }[]>`
    SELECT count(*)::int AS tabelas FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'`;
  check(tabelas === 41, `Tabelas criadas: ${tabelas} (esperado 41)`);

  const [{ fks }] = await prisma.$queryRaw<{ fks: number }[]>`
    SELECT count(*)::int AS fks FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'`;
  check(fks === 89, `Vínculos entre tabelas: ${fks} (esperado 89)`);

  const [{ checks }] = await prisma.$queryRaw<{ checks: number }[]>`
    SELECT count(*)::int AS checks FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' AND c.contype = 'c'`;
  check(checks === 6, `Regras de valores permitidos: ${checks} (esperado 6)`);

  check((await prisma.horario_grade.count()) === 12, 'Grade de horários com 12 faixas');
  check((await prisma.ano_letivo.count({ where: { ano: 2026 } })) === 1, 'Ano letivo 2026 cadastrado');

  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase() ?? '';
  const admin = await prisma.usuarios.findUnique({
    where: { email },
    include: { profile: true, user_roles: true },
  });
  check(!!admin, `Administrador ${email} existe`);
  check(admin?.profile?.status === 'ativo', 'Administrador está ativo');
  check(!!admin?.user_roles.some((r) => r.role === 'admin'), 'Administrador tem papel admin');
  // O seed cria o admin com troca obrigatória; depois do 1º acesso, ele já trocou. Os dois estados são válidos.
  check(
    typeof admin?.deve_trocar_senha === 'boolean',
    `Administrador ${admin?.deve_trocar_senha ? 'ainda precisa trocar a senha temporária' : 'já trocou a senha do 1º acesso'}`,
  );
  check(
    !!admin && !(await verifyPassword('senha-errada', admin.senha_hash)),
    'Senha errada é rejeitada',
  );

  // Regras ativas: o banco deve recusar dados inválidos
  check(
    await bancoRecusa((tx) =>
      tx.usuarios.create({
        data: { email: `teste-${Date.now()}@x.com`, senha_hash: 'x', profile: { create: { status: 'qualquer' } } },
      }),
    ),
    'Banco recusa status de perfil inválido',
  );
  check(
    await bancoRecusa((tx) =>
      tx.turma_membros.create({
        data: {
          turma_id: '00000000-0000-0000-0000-000000000000',
          aluno_id: '00000000-0000-0000-0000-000000000000',
          user_id: admin!.id,
        },
      }),
    ),
    'Banco recusa vínculo com turma/aluno inexistente',
  );
  check(
    await bancoRecusa((tx) => tx.usuarios.create({ data: { email: admin!.email, senha_hash: 'x' } })),
    'Banco recusa e-mail de usuário duplicado',
  );

  console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} conferência(s) falharam.`);
  process.exitCode = falhas === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
