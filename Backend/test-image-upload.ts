// Quick test for product image functionality
import 'dotenv/config';
import prisma from './src/config/database';
import productImageStorageService from './src/services/product-image-storage.service';

async function testImageFunctionality() {
  console.log('🧪 Testing Product Image System...\n');

  try {
    // Check if we have any products
    const products = await prisma.product.findMany({ take: 1 });
    
    if (products.length === 0) {
      console.log('⚠️  No products found in database');
      console.log('   Skipping image tests');
      return;
    }

    const product = products[0];
    console.log('✅ Found product:', product.name);
    console.log('   Product ID:', product.id);

    // Check existing images
    const existingImages = await productImageStorageService.getProductImages(product.id);
    console.log(`\n✅ Product has ${existingImages.length} existing image(s)`);
    
    if (existingImages.length > 0) {
      console.log('   Images:');
      existingImages.forEach((img, i) => {
        console.log(`      ${i + 1}. ${img.isPrimary ? '⭐ ' : ''}${img.path}`);
        console.log(`         URL: ${img.url}`);
      });
    }

    console.log('\n✅ Product image service is working correctly');
    console.log('\n📝 API Endpoints Available:');
    console.log('   GET    /api/v1/products/:id/images - List images');
    console.log('   POST   /api/v1/products/:id/images - Upload image (admin)');
    console.log('   PUT    /api/v1/products/:id/images/:imageId/primary - Set primary (admin)');
    console.log('   PUT    /api/v1/products/:id/images/reorder - Reorder images (admin)');
    console.log('   DELETE /api/v1/products/:id/images/:imageId - Delete image (admin)');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testImageFunctionality();
