// Verification script for Supabase client configuration
// Run: tsx verify-supabase.ts

import 'dotenv/config';
import supabase from './src/config/supabase';

console.log('🔍 Verifying Supabase Configuration...\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log('  SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('  SUPABASE_SECRET_KEY:', process.env.SUPABASE_SECRET_KEY ? '✅ Set' : '❌ Missing');

// Check if client has expected methods
const hasStorage = typeof supabase.storage === 'object';
const hasAuth = typeof supabase.auth === 'object';

console.log('\n🔧 Client Methods:');
console.log('  storage:', hasStorage ? '✅ Available' : '❌ Missing');
console.log('  auth:', hasAuth ? '✅ Available' : '❌ Missing');

console.log('\n🎯 Client Type:', supabase.constructor.name);

if (hasStorage && hasAuth) {
  console.log('\n🎉 Supabase client configured correctly!');
  console.log('\n📝 Usage Example:');
  console.log('  import supabase from "./config/supabase";');
  console.log('  ');
  console.log('  // Upload file');
  console.log('  const { data, error } = await supabase.storage');
  console.log('    .from("product-images")');
  console.log('    .upload("path/file.jpg", fileBuffer);');
  console.log('  ');
  console.log('  // Delete file');
  console.log('  await supabase.storage');
  console.log('    .from("product-images")');
  console.log('    .remove(["path/file.jpg"]);');
  console.log('  ');
  console.log('  // List files');
  console.log('  const { data: files } = await supabase.storage');
  console.log('    .from("product-images")');
  console.log('    .list("path/");');
} else {
  console.error('\n❌ Supabase client is missing expected methods!');
  process.exit(1);
}
