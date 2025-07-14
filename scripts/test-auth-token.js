const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

async function testAuthToken() {
  try {
    console.log('🔍 Testing authentication token...');

    // Check if there are any active sessions
    const sessions = await prisma.session.findMany({
      where: {
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    console.log(`📊 Active sessions found: ${sessions.length}`);

    if (sessions.length === 0) {
      console.log('❌ No active sessions found. Creating a new one...');
      
      // Find admin user
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
        console.log('❌ No admin user found.');
        return;
      }

      // Create new session
      const token = jwt.sign(
        { userId: adminUser.id },
        process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production'
      );

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const newSession = await prisma.session.create({
        data: {
          userId: adminUser.id,
          token: token,
          expiresAt: expiresAt
        }
      });

      console.log(`✅ New session created for ${adminUser.email}`);
      console.log(`🔑 Token: ${token}`);
      console.log(`⏰ Expires: ${expiresAt.toLocaleString()}`);
      
      // Test the token
      const testResponse = await fetch('http://localhost:3000/api/courses', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`📡 Test API call status: ${testResponse.status}`);
      
      if (testResponse.ok) {
        const data = await testResponse.json();
        console.log(`✅ API working! Courses found: ${data.data?.length || 0}`);
      } else {
        const error = await testResponse.text();
        console.log(`❌ API error: ${error}`);
      }

    } else {
      console.log('\n🔑 Active sessions:');
      sessions.forEach((session, index) => {
        console.log(`  ${index + 1}. User: ${session.user.email} (${session.user.profile?.role})`);
        console.log(`     Token: ${session.token.substring(0, 20)}...`);
        console.log(`     Expires: ${session.expiresAt.toLocaleString()}`);
        console.log('     ---');
      });

      // Test the first session
      const testSession = sessions[0];
      console.log(`\n🧪 Testing token for ${testSession.user.email}...`);
      
      const testResponse = await fetch('http://localhost:3000/api/courses', {
        headers: {
          'Authorization': `Bearer ${testSession.token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`📡 Test API call status: ${testResponse.status}`);
      
      if (testResponse.ok) {
        const data = await testResponse.json();
        console.log(`✅ API working! Courses found: ${data.data?.length || 0}`);
        console.log(`💡 Use this token in localStorage: ${testSession.token}`);
      } else {
        const error = await testResponse.text();
        console.log(`❌ API error: ${error}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAuthToken();
