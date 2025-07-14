const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedCourses() {
  try {
    console.log('🌱 Inserindo cursos de exemplo...');

    // Verificar se já existem cursos
    const existingCourses = await prisma.course.findMany();
    if (existingCourses.length > 0) {
      console.log(`✅ Já existem ${existingCourses.length} cursos no banco de dados.`);
      console.log('Cursos existentes:');
      existingCourses.forEach(course => {
        console.log(`  - ${course.name}`);
      });
      return;
    }

    // Criar cursos de exemplo
    const courses = [
      {
        name: 'Academy',
        description: 'Curso básico de inglês para iniciantes',
        duration: 40,
        price: 299.90,
        allowsMakeup: true
      },
      {
        name: 'Master',
        description: 'Curso avançado de inglês para fluência',
        duration: 60,
        price: 499.90,
        allowsMakeup: true
      },
      {
        name: 'Intensivox',
        description: 'Curso intensivo de conversação em inglês',
        duration: 20,
        price: 199.90,
        allowsMakeup: false
      },
      {
        name: 'Business English',
        description: 'Inglês para negócios e ambiente corporativo',
        duration: 30,
        price: 399.90,
        allowsMakeup: true
      },
      {
        name: 'TOEFL Prep',
        description: 'Preparação para o exame TOEFL',
        duration: 25,
        price: 349.90,
        allowsMakeup: true
      }
    ];

    for (const courseData of courses) {
      const course = await prisma.course.create({
        data: courseData
      });
      console.log(`✅ Curso criado: ${course.name}`);
    }

    console.log('🎉 Cursos de exemplo inseridos com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inserir cursos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedCourses();
