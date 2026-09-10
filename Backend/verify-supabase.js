// Verification script for Supabase client configuration
// Run: node verify-supabase.js

require('dotenv').config();

console.log('🔍 Verifying Supabase Configuration...\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log('  SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('  SUPABASE_SECRET_KEY:', process.env.SUPABASE_SECRET_KEY ? '✅ Set' : '❌ Missing');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.error('\n❌ Missing required environment variables!');
  process.exit(1);
}

// Try to import the Supabase client
console.log('\n📦 Importing Supabase Client...');

try {
  const supabase = require('./dist/config/supabase').default;
  console.log('✅ Supabase client imported successfully');
  
  // Check if client has expected methods
  const hasStorage = typeof supabase.storage === 'object';
  const hasAuth = typeof supabase.auth === 'object';
  
  console.log('\n🔧 Client Methods:');
  console.log('  storage:', hasStorage ? '✅ Available' : '❌ Missing');
  console.log('  auth:', hasAuth ? '✅ Available' : '❌ Missing');
  
  if (hasStorage && hasAuth) {
    console.log('\n🎉 Supabase client configured correctly!');
    console.log('\n📝 Usage Example:');
    console.log('  import supabase from "@/config/supabase";');
    console.log('  const { data, error } = await supabase.storage');
    console.log('    .from("bucket-name")');
    console.log('    .upload("path/file.jpg", fileBuffer);');
  } else {
    console.error('\n❌ Supabase client is missing expected methods!');
    process.exit(1);
  }
  
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('dist/config/supabase')) {
    console.log('⚠️  TypeScript not compiled yet. Run "npm run build" first.');
    console.log('   Or test with: tsx verify-supabase.ts');
    process.exit(0);
  } else {
    console.error('\n❌ Failed to import Supabase client:', error.message);
    process.exit(1);
  }
}
