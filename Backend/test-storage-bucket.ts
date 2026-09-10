// Test script for Supabase Storage "products" bucket
// Run: npx tsx test-storage-bucket.ts

import 'dotenv/config';
import supabase from './src/config/supabase';

console.log('🧪 Testing Supabase Storage Connection...\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const BUCKET_NAME = 'products';

async function testStorageBucket() {
  try {
    // Test 1: Check if client is initialized
    console.log('📦 Test 1: Client Initialization');
    console.log('   Client Type:', supabase.constructor.name);
    console.log('   Storage Available:', typeof supabase.storage === 'object' ? '✅ Yes' : '❌ No');
    console.log('');

    // Test 2: List all buckets
    console.log('📦 Test 2: List All Buckets');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('   ❌ Error listing buckets:', bucketsError.message);
      throw bucketsError;
    }
    
    console.log(`   ✅ Found ${buckets.length} bucket(s):`);
    buckets.forEach(bucket => {
      console.log(`      - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
    });
    console.log('');

    // Test 3: Check if "products" bucket exists
    console.log('📦 Test 3: Verify "products" Bucket');
    const productsBucket = buckets.find(b => b.name === BUCKET_NAME);
    
    if (!productsBucket) {
      console.error(`   ❌ Bucket "${BUCKET_NAME}" not found!`);
      console.log('   Available buckets:', buckets.map(b => b.name).join(', '));
      throw new Error(`Bucket "${BUCKET_NAME}" does not exist`);
    }
    
    console.log(`   ✅ Bucket "${BUCKET_NAME}" found`);
    console.log(`   Public: ${productsBucket.public ? 'Yes' : 'No'}`);
    console.log(`   Created: ${productsBucket.created_at}`);
    console.log(`   Updated: ${productsBucket.updated_at}`);
    console.log('');

    // Test 4: Get bucket details
    console.log('📦 Test 4: Get Bucket Details');
    const { data: bucketInfo, error: bucketError } = await supabase.storage.getBucket(BUCKET_NAME);
    
    if (bucketError) {
      console.error('   ⚠️  Could not get bucket details:', bucketError.message);
    } else {
      console.log('   ✅ Bucket details retrieved');
      console.log(`   ID: ${bucketInfo.id}`);
      console.log(`   Name: ${bucketInfo.name}`);
      console.log(`   Public: ${bucketInfo.public}`);
      if (bucketInfo.file_size_limit) {
        console.log(`   File Size Limit: ${(bucketInfo.file_size_limit / 1024 / 1024).toFixed(2)} MB`);
      }
      if (bucketInfo.allowed_mime_types && bucketInfo.allowed_mime_types.length > 0) {
        console.log(`   Allowed MIME Types: ${bucketInfo.allowed_mime_types.join(', ')}`);
      }
    }
    console.log('');

    // Test 5: List files in bucket (root directory)
    console.log('📦 Test 5: List Files in Bucket');
    const { data: files, error: filesError } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', {
        limit: 10,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });
    
    if (filesError) {
      console.error('   ❌ Error listing files:', filesError.message);
      throw filesError;
    }
    
    console.log(`   ✅ Bucket is accessible`);
    console.log(`   Files/Folders found: ${files.length}`);
    
    if (files.length > 0) {
      console.log('\n   📁 Contents (showing up to 10):');
      files.forEach((file, index) => {
        const icon = file.id ? '📄' : '📁';
        const size = file.metadata?.size ? ` (${(file.metadata.size / 1024).toFixed(2)} KB)` : '';
        console.log(`      ${index + 1}. ${icon} ${file.name}${size}`);
      });
    } else {
      console.log('   ℹ️  Bucket is empty (no files or folders)');
    }
    console.log('');

    // Test 6: Test public URL generation (if bucket is public)
    if (productsBucket.public) {
      console.log('📦 Test 6: Test Public URL Generation');
      const testPath = 'test-file.jpg';
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(testPath);
      
      console.log('   ✅ Public URL generation works');
      console.log('   Example URL format:', urlData.publicUrl);
      console.log('   ℹ️  (This is just an example URL, file does not need to exist)');
      console.log('');
    }

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎉 All Tests Passed!');
    console.log('\n✅ Summary:');
    console.log(`   - Supabase client: Initialized`);
    console.log(`   - Storage API: Accessible`);
    console.log(`   - Bucket "${BUCKET_NAME}": Found and accessible`);
    console.log(`   - Bucket type: ${productsBucket.public ? 'Public' : 'Private'}`);
    console.log(`   - Files in bucket: ${files.length}`);
    console.log('\n📝 Next Steps:');
    console.log('   - Create upload endpoint for product images');
    console.log('   - Implement image deletion');
    console.log('   - Add image management routes');
    console.log('');

  } catch (error: any) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.error('❌ Test Failed!');
    console.error('\nError Details:');
    console.error('   Message:', error.message);
    if (error.statusCode) {
      console.error('   Status Code:', error.statusCode);
    }
    if (error.error) {
      console.error('   Error Type:', error.error);
    }
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Verify SUPABASE_URL is correct in .env');
    console.log('   2. Verify SUPABASE_SECRET_KEY is correct in .env');
    console.log('   3. Check that "products" bucket exists in Supabase Dashboard');
    console.log('   4. Ensure Storage is enabled in your Supabase project');
    console.log('');
    process.exit(1);
  }
}

// Run the test
testStorageBucket();
