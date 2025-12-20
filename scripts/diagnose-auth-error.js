#!/usr/bin/env node

/**
 * Auth Error Diagnostic Script
 * 
 * This script checks for common authentication configuration issues
 * that could cause the "Authentication Error" in the dev server.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Auth Error Diagnostic Tool\n');
console.log('='.repeat(50));

// Check 1: Environment Variables
console.log('\n1️⃣ Checking Environment Variables...\n');

const envPath = path.join(process.cwd(), '.env.local');
const envExamplePath = path.join(process.cwd(), 'env.example');

let envVars = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      envVars[key] = value;
    }
  });
  console.log('✅ .env.local file exists');
} else {
  console.log('❌ .env.local file NOT FOUND');
  console.log('   → Create it by copying env.example: cp env.example .env.local');
}

// Check required variables
const requiredVars = [
  { key: 'JWT_SECRET', alt: 'NEXTAUTH_SECRET', description: 'JWT/NextAuth secret key' },
  { key: 'NEXTAUTH_SECRET', alt: 'JWT_SECRET', description: 'NextAuth secret key' },
  { key: 'NEXTAUTH_URL', description: 'NextAuth URL (should be http://localhost:3000 for dev)' },
  { key: 'DATABASE_URL', description: 'PostgreSQL database connection string' },
];

let hasAuthSecret = false;
let missingVars = [];

requiredVars.forEach(({ key, alt, description }) => {
  const value = envVars[key] || (alt && envVars[alt]);
  if (value) {
    if (key === 'JWT_SECRET' || key === 'NEXTAUTH_SECRET') {
      hasAuthSecret = true;
      console.log(`✅ ${key}: ${value.substring(0, 10)}... (${value.length} chars)`);
    } else if (key === 'DATABASE_URL') {
      // Don't show full database URL for security
      const isSet = value && value.length > 0;
      console.log(`✅ ${key}: ${isSet ? 'SET' : 'NOT SET'} (${isSet ? value.substring(0, 20) + '...' : 'MISSING'})`);
    } else {
      console.log(`✅ ${key}: ${value}`);
    }
  } else {
    missingVars.push({ key, alt, description });
    console.log(`❌ ${key}: NOT SET`);
    if (alt) {
      console.log(`   → Alternative: ${alt} (also not set)`);
    }
    console.log(`   → Required for: ${description}`);
  }
});

// Check if at least one auth secret is set
if (!hasAuthSecret) {
  console.log('\n🚨 CRITICAL: No authentication secret found!');
  console.log('   → Set either JWT_SECRET or NEXTAUTH_SECRET in .env.local');
}

// Check 2: NextAuth API Route
console.log('\n2️⃣ Checking NextAuth API Route...\n');

const nextAuthRoutePath = path.join(process.cwd(), 'app', 'api', 'auth', '[...nextauth]', 'route.ts');
if (fs.existsSync(nextAuthRoutePath)) {
  console.log('✅ NextAuth API route exists: app/api/auth/[...nextauth]/route.ts');
  
  // Check if it exports NextAuth
  const routeContent = fs.readFileSync(nextAuthRoutePath, 'utf8');
  if (routeContent.includes('NextAuth') || routeContent.includes('authOptions')) {
    console.log('✅ NextAuth handler found in route file');
  } else {
    console.log('⚠️  NextAuth handler may not be properly configured');
  }
} else {
  console.log('❌ NextAuth API route NOT FOUND');
  console.log('   → Expected: app/api/auth/[...nextauth]/route.ts');
}

// Check 3: Auth Configuration File
console.log('\n3️⃣ Checking Auth Configuration...\n');

const authConfigPath = path.join(process.cwd(), 'lib', 'auth.ts');
if (fs.existsSync(authConfigPath)) {
  console.log('✅ Auth configuration file exists: lib/auth.ts');
  
  const authContent = fs.readFileSync(authConfigPath, 'utf8');
  if (authContent.includes('authOptions')) {
    console.log('✅ authOptions found');
  }
  if (authContent.includes('CredentialsProvider')) {
    console.log('✅ CredentialsProvider found');
  }
} else {
  console.log('❌ Auth configuration file NOT FOUND');
  console.log('   → Expected: lib/auth.ts');
}

// Check 4: Providers Setup
console.log('\n4️⃣ Checking Providers Setup...\n');

const providersPath = path.join(process.cwd(), 'app', 'providers.tsx');
if (fs.existsSync(providersPath)) {
  console.log('✅ Providers file exists: app/providers.tsx');
  
  const providersContent = fs.readFileSync(providersPath, 'utf8');
  if (providersContent.includes('SessionProvider')) {
    console.log('✅ SessionProvider found');
  }
  if (providersContent.includes('AuthErrorBoundary')) {
    console.log('✅ AuthErrorBoundary found');
  }
} else {
  console.log('❌ Providers file NOT FOUND');
  console.log('   → Expected: app/providers.tsx');
}

// Check 5: Database Connection
console.log('\n5️⃣ Database Connection Check...\n');

if (envVars.DATABASE_URL) {
  console.log('✅ DATABASE_URL is set');
  console.log('   → To test connection, run: npx prisma db push');
  console.log('   → Or: npx prisma studio');
} else {
  console.log('❌ DATABASE_URL is NOT SET');
  console.log('   → Database connection will fail');
  console.log('   → Format: postgresql://user:password@host:port/database');
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('\n📊 DIAGNOSTIC SUMMARY\n');

if (missingVars.length === 0 && hasAuthSecret) {
  console.log('✅ All required environment variables are set');
} else {
  console.log('❌ Missing required environment variables:');
  missingVars.forEach(({ key, description }) => {
    console.log(`   - ${key}: ${description}`);
  });
  if (!hasAuthSecret) {
    console.log('\n🚨 CRITICAL: No authentication secret found!');
  }
}

console.log('\n💡 RECOMMENDED FIXES:\n');

if (!fs.existsSync(envPath)) {
  console.log('1. Create .env.local file:');
  console.log('   cp env.example .env.local');
  console.log('');
}

if (missingVars.length > 0 || !hasAuthSecret) {
  console.log('2. Add missing environment variables to .env.local:');
  if (!hasAuthSecret) {
    console.log('   JWT_SECRET="your-super-secret-jwt-key-here"');
    console.log('   NEXTAUTH_SECRET="your-nextauth-secret-key-here"');
  }
  missingVars.forEach(({ key }) => {
    if (key !== 'JWT_SECRET' && key !== 'NEXTAUTH_SECRET') {
      if (key === 'NEXTAUTH_URL') {
        console.log(`   ${key}="http://localhost:3000"`);
      } else if (key === 'DATABASE_URL') {
        console.log(`   ${key}="postgresql://user:password@localhost:5432/snapbet"`);
      } else {
        console.log(`   ${key}="your-value-here"`);
      }
    }
  });
  console.log('');
}

console.log('3. Restart your dev server after adding environment variables:');
console.log('   npm run dev');
console.log('');

console.log('4. If error persists, check browser console for specific error messages');
console.log('');

console.log('='.repeat(50));



