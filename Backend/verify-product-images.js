// Verification script for ProductImage model
// Run: node verify-product-images.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyProductImageModel() {
  console.log('🔍 Verifying ProductImage model...\n');

  try {
    // Check if ProductImage model exists
    console.log('✅ ProductImage model exists in Prisma Client');
    console.log('✅ Model methods available:', Object.keys(prisma.productImage).join(', '));

    // Check table structure (try to query without data)
    const count = await prisma.productImage.count();
    console.log(`✅ product_images table exists (${count} records)`);

    // Check if relation works
    const productWithImages = await prisma.product.findFirst({
      include: {
        productImages: true
      }
    });
    console.log('✅ Product → ProductImage relation working');
    
    if (productWithImages) {
      console.log(`   Sample product: ${productWithImages.name}`);
      console.log(`   Images: ${productWithImages.productImages.length}`);
    } else {
      console.log('   No products found (database might be empty)');
    }

    console.log('\n🎉 All verifications passed!');
    console.log('\n📋 ProductImage Model Fields:');
    console.log('   - id: String (cuid)');
    console.log('   - productId: String');
    console.log('   - path: String');
    console.log('   - url: String?');
    console.log('   - isPrimary: Boolean');
    console.log('   - sortOrder: Int');
    console.log('   - createdAt: DateTime');
    console.log('\n🔗 Relationships:');
    console.log('   - product: Product (many-to-one with CASCADE delete)');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyProductImageModel();
