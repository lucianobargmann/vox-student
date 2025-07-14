const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('🔍 Verificando usuários no banco de dados...');

    const users = await prisma.user.findMany({
      include: {
        profile: true
      }
    });

    console.log(`📊 Total de usuários: ${users.length}`);
    
    if (users.length > 0) {
      console.log('\n👥 Usuários encontrados:');
      users.forEach(user => {
        console.log(`  - Email: ${user.email}`);
        console.log(`    Role: ${user.profile?.role || 'N/A'}`);
        console.log(`    Nome: ${user.profile?.fullName || 'N/A'}`);
        console.log(`    Verificado: ${user.emailVerified ? 'Sim' : 'Não'}`);
        console.log('    ---');
      });
    } else {
      console.log('❌ Nenhum usuário encontrado no banco de dados.');
      console.log('💡 Você precisa fazer login primeiro para criar um usuário.');
    }

    // Verificar cursos
    const courses = await prisma.course.findMany();
    console.log(`\n📚 Total de cursos: ${courses.length}`);
    
    if (courses.length > 0) {
      console.log('\n📖 Cursos encontrados:');
      courses.forEach(course => {
        console.log(`  - ${course.name} (${course.duration}h) - R$ ${course.price || 'Gratuito'}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro ao verificar usuários:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
