#!/usr/bin/env node

/**
 * Script to update user role to admin
 * Usage: node scripts/update-user-role.js <email>
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateUserRole(email, newRole = 'admin') {
  try {
    console.log(`🔄 Updating user role for: ${email}`);
    
    const user = await prisma.user.update({
      where: { email },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        role: true,
        fullName: true
      }
    });
    
    console.log('✅ User role updated successfully!');
    console.log('📋 Updated user details:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.fullName || 'N/A'}`);
    console.log(`   Role: ${user.role}`);
    
    return user;
  } catch (error) {
    if (error.code === 'P2025') {
      console.error('❌ User not found with that email address');
    } else {
      console.error('❌ Error updating user role:', error.message);
    }
    throw error;
  }
}

async function main() {
  const email = process.argv[2];
  
  if (!email) {
    console.error('❌ Please provide an email address');
    console.log('Usage: node scripts/update-user-role.js <email>');
    console.log('Example: node scripts/update-user-role.js test@example.com');
    process.exit(1);
  }
  
  try {
    await updateUserRole(email);
    console.log('\n🎉 User role updated! You can now access admin routes.');
    console.log('💡 You may need to sign out and sign back in for the changes to take effect.');
  } catch (error) {
    console.error('\n💥 Failed to update user role');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { updateUserRole }; 