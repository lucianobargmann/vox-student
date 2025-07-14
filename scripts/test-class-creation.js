const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

async function testClassCreation() {
  try {
    console.log('🧪 Testando criação de turma...');

    // Buscar um usuário admin
    const adminUser = await prisma.user.findFirst({
      where: {
        profile: {
          role: {
            in: ['admin', 'super_admin']
          }
        }
      },
      include: {
        profile: true
      }
    });

    if (!adminUser) {
      console.log('❌ Nenhum usuário admin encontrado.');
      return;
    }

    console.log(`👤 Usando usuário: ${adminUser.email} (${adminUser.profile?.role})`);

    // Buscar um curso para usar na criação da turma
    const course = await prisma.course.findFirst();
    if (!course) {
      console.log('❌ Nenhum curso encontrado.');
      return;
    }

    console.log(`📚 Usando curso: ${course.name}`);

    // Criar uma sessão temporária para teste
    const token = jwt.sign(
      { userId: adminUser.id },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production'
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 dias

    const session = await prisma.session.create({
      data: {
        userId: adminUser.id,
        token: token,
        expiresAt: expiresAt
      }
    });

    console.log(`🔑 Token criado para teste`);

    // Testar a API de criação de turma
    const fetch = require('node-fetch');
    
    const classData = {
      name: 'Turma Teste - ' + new Date().toISOString().slice(0, 10),
      description: 'Turma criada automaticamente para teste',
      courseId: course.id,
      startDate: '2024-08-01',
      endDate: '2024-12-15',
      maxStudents: 20,
      isActive: true
    };

    const response = await fetch('http://localhost:3000/api/classes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(classData)
    });

    console.log(`📡 Status da resposta: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Turma criada com sucesso!');
      console.log(`🎓 ID da turma: ${data.data.id}`);
      console.log(`📝 Nome: ${data.data.name}`);
      console.log(`📚 Curso: ${course.name}`);
    } else {
      const error = await response.text();
      console.log('❌ Erro na criação da turma:', error);
    }

    // Limpar a sessão de teste
    await prisma.session.delete({
      where: { id: session.id }
    });

    console.log('🧹 Sessão de teste removida');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testClassCreation();
