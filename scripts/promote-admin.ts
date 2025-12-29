/**
 * Script to promote a user to admin role
 * Usage: npx tsx scripts/promote-admin.ts <email>
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma adapter for PostgreSQL
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function promoteToAdmin(email: string) {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true }
    });

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    if (user.role === 'admin') {
      console.log(`ℹ️  User ${email} is already an admin`);
      process.exit(0);
    }

    // Update user role to admin
    await prisma.user.update({
      where: { email },
      data: { role: 'admin' }
    });

    console.log(`✅ Successfully promoted ${email} to admin`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Name: ${user.name || 'N/A'}`);
    
  } catch (error) {
    console.error('❌ Error promoting user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('Usage: npx tsx scripts/promote-admin.ts <email>');
  process.exit(1);
}

promoteToAdmin(email);
