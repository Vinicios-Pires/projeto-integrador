/**
 * Dados iniciais obrigatórios do sistema. Pode ser executado várias vezes
 * sem duplicar nada (idempotente).
 *
 * - Grade de horários padrão da escola (só se a grade estiver vazia)
 * - Ano letivo 2026
 * - Primeiro administrador (e-mail em ADMIN_BOOTSTRAP_EMAIL)
 */
import 'dotenv/config';
import { PrismaClient, tipo_bloco_horario } from '@prisma/client';
import { generateTempPassword, hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

const GRADE_PADRAO: Array<[number, string, string, string, tipo_bloco_horario]> = [
  [1, 'Entrada/Acolhimento', '07:00', '07:30', 'outro'],
  [2, '1ª aula', '07:30', '08:20', 'aula'],
  [3, '2ª aula', '08:20', '09:10', 'aula'],
  [4, '3ª aula', '09:10', '10:00', 'aula'],
  [5, 'Intervalo', '10:00', '10:20', 'intervalo'],
  [6, '4ª aula', '10:20', '11:10', 'aula'],
  [7, '5ª aula', '11:10', '12:00', 'aula'],
  [8, 'Almoço', '12:00', '13:00', 'almoco'],
  [9, '6ª aula', '13:00', '13:50', 'aula'],
  [10, '7ª aula', '13:50', '14:40', 'aula'],
  [11, '8ª aula', '14:40', '15:30', 'aula'],
  [12, '9ª aula / ATPC', '15:30', '16:30', 'atpc'],
];

/** Colunas TIME do Postgres são representadas pelo Prisma como Date em 1970-01-01 UTC. */
const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

async function seedHorarioGrade() {
  if ((await prisma.horario_grade.count()) > 0) {
    console.log('• Grade de horários: já existe, mantida.');
    return;
  }
  await prisma.horario_grade.createMany({
    data: GRADE_PADRAO.map(([ordem, rotulo, inicio, fim, tipo]) => ({
      ordem,
      rotulo,
      hora_inicio: time(inicio),
      hora_fim: time(fim),
      tipo,
    })),
  });
  console.log(`• Grade de horários: ${GRADE_PADRAO.length} faixas criadas.`);
}

async function seedAnoLetivo() {
  await prisma.ano_letivo.upsert({
    where: { ano: 2026 },
    update: {},
    create: {
      ano: 2026,
      data_inicio: new Date('2026-02-02'),
      data_fim: new Date('2026-12-18'),
      ativo: true,
    },
  });
  console.log('• Ano letivo 2026: ok.');
}

async function seedAdmin() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (!email) {
    console.log('• Administrador: ADMIN_BOOTSTRAP_EMAIL não definido, pulando.');
    return;
  }

  const existente = await prisma.usuarios.findUnique({ where: { email } });
  if (existente) {
    console.log(`• Administrador ${email}: já existe, senha mantida.`);
    return;
  }

  const senhaInformada = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim();
  const senha = senhaInformada || generateTempPassword();

  await prisma.usuarios.create({
    data: {
      email,
      senha_hash: await hashPassword(senha),
      deve_trocar_senha: true,
      profile: { create: { nome: 'Administrador', email, status: 'ativo' } },
      user_roles: { create: { role: 'admin' } },
    },
  });

  console.log(`• Administrador ${email}: criado (troca de senha exigida no 1º acesso).`);
  if (!senhaInformada) {
    console.log(`  Senha temporária (anote agora, ela não será exibida de novo): ${senha}`);
  }
}

async function main() {
  await seedHorarioGrade();
  await seedAnoLetivo();
  await seedAdmin();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
