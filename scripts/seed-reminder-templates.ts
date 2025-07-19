import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const reminderTemplates = [
  {
    name: 'Lembrete Aula Amanhã',
    category: 'aula',
    description: 'Enviado para alunos 24h antes da aula, incluindo reposições',
    template: `Olá {{nome_do_aluno}}! 👋

Você tem aula de {{nome_curso}} marcada para amanhã ({{data_aula}}) às {{hora_inicio_aula}}.

📚 Turma: {{nome_aula}}
👩‍🏫 Professor(a): {{nome_professor}}
⏰ Horário: {{hora_inicio_aula}} às {{hora_fim_aula}}

Não esqueça de trazer seus materiais!

Qualquer dúvida, entre em contato: {{telefone_suporte}}

VoxStudent 🎓`
  },
  {
    name: 'Agendamento de Mentoria',
    category: 'mentoria',
    description: 'Lembrete para o aluno agendar uma mentoria individual',
    template: `Olá {{nome_do_aluno}}! 🌟

É hora de agendar sua mentoria individual! 

Aproveite esta oportunidade para:
✅ Tirar dúvidas específicas
✅ Receber feedback personalizado
✅ Definir seus próximos passos

👩‍🏫 Professor(a) disponível: {{nome_professor}}

Para agendar, acesse: {{url_sistema}}
Ou entre em contato: {{telefone_suporte}}

VoxStudent - Seu sucesso é nossa meta! 🎯`
  },
  {
    name: 'Mentoria Amanhã',
    category: 'mentoria',
    description: 'Confirmação de mentoria agendada para o próximo dia',
    template: `Olá {{nome_do_aluno}}! 🎯

Sua mentoria está confirmada para amanhã!

📅 Data: {{data_aula}}
⏰ Horário: {{hora_inicio_aula}} às {{hora_fim_aula}}
👩‍🏫 Professor(a): {{nome_professor}}

Prepare suas dúvidas e objetivos para aproveitar ao máximo este momento!

Nos vemos em breve! 💪

VoxStudent 🎓`
  },
  {
    name: 'Reposição de Aula Disponível',
    category: 'reposicao',
    description: 'Notifica o aluno sobre aulas perdidas e opções de reposição',
    template: `Olá {{nome_do_aluno}}! 

Você tem a aula #{{titulo_aula}} de {{nome_curso}} para repor.

📋 Opções de reposição disponíveis:

🗓️ Agende sua reposição através do sistema: {{url_sistema}}

📞 Ou entre em contato conosco: {{telefone_suporte}}

⚠️ Importante: Aulas não repostas podem prejudicar seu aprendizado.

Contamos com você!

VoxStudent 🎓`
  },
  {
    name: 'Bom Dia - Aula Hoje',
    category: 'aula',
    description: 'Mensagem matinal para alunos com aula no dia',
    template: `Bom dia, {{nome_do_aluno}}! ☀️

Hoje é dia de aula! 🎉

📚 {{nome_curso}} - {{nome_aula}}
⏰ {{hora_inicio_aula}} às {{hora_fim_aula}}
👩‍🏫 Professor(a): {{nome_professor}}

Vamos aprender juntos! 💪

VoxStudent 🎓`
  },
  {
    name: 'Faltou à Aula',
    category: 'aula',
    description: 'Enviado quando o aluno não comparece à aula',
    template: `Olá {{nome_do_aluno}},

Sentimos sua falta na aula de {{nome_curso}} hoje ({{data_aula}}).

😔 Sua presença faz diferença!

Para repor esta aula:
🔄 Acesse: {{url_sistema}}
📞 Ou ligue: {{telefone_suporte}}

Vamos continuar juntos na sua jornada de aprendizado! 🌟

VoxStudent 🎓`
  }
];

async function seedReminderTemplates() {
  console.log('🌱 Criando templates de lembrete...');

  try {
    for (const template of reminderTemplates) {
      // Check if template already exists
      const existing = await prisma.reminderTemplate.findFirst({
        where: { name: template.name }
      });

      if (existing) {
        console.log(`⏭️  Template "${template.name}" já existe. Pulando...`);
        continue;
      }

      await prisma.reminderTemplate.create({
        data: template
      });

      console.log(`✅ Criado: ${template.name}`);
    }

    console.log('🎉 Templates de lembrete criados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao criar templates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  seedReminderTemplates();
}

export { seedReminderTemplates };