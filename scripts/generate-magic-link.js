const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function generateMagicLink() {
  try {
    const email = 'luciano@hcktplanet.com';
    console.log(`🔗 Gerando magic link para: ${email}`);

    // Buscar ou criar usuário
    let user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true }
    });

    if (!user) {
      console.log('👤 Usuário não encontrado, criando...');
      user = await prisma.user.create({
        data: {
          email,
          emailVerified: true,
          profile: {
            create: {
              fullName: 'Super Admin',
              role: 'super_admin'
            }
          }
        },
        include: { profile: true }
      });
    }

    // Gerar token único
    const token = crypto.randomBytes(32).toString('hex');
    
    // Criar magic link
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutos

    const magicLink = await prisma.magicLink.create({
      data: {
        userId: user.id,
        token,
        email,
        expiresAt
      }
    });

    const loginUrl = `http://localhost:3001/auth/verify?token=${token}`;
    
    console.log('✅ Magic link gerado com sucesso!');
    console.log(`🔗 URL de login: ${loginUrl}`);
    console.log(`⏰ Expira em: ${expiresAt.toLocaleString()}`);
    
    return loginUrl;

  } catch (error) {
    console.error('❌ Erro ao gerar magic link:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateMagicLink();
