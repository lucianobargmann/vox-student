const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

async function testCoursesAPI() {
  try {
    console.log('🧪 Testando API de cursos...');

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

    console.log(`🔑 Token criado: ${token.substring(0, 20)}...`);

    // Testar a API de cursos
    const fetch = require('node-fetch');
    
    const response = await fetch('http://localhost:3001/api/courses', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`📡 Status da resposta: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API de cursos funcionando!');
      console.log(`📚 Cursos retornados: ${data.data.length}`);
      data.data.forEach(course => {
        console.log(`  - ${course.name}`);
      });
    } else {
      const error = await response.text();
      console.log('❌ Erro na API:', error);
    }

    // Limpar a sessão de teste
    await prisma.session.delete({
      where: { id: session.id }
    });

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCoursesAPI();
