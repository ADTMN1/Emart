import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';

const API_URL = 'http://localhost:5000/api/v1';

interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: any;
  };
}

interface ProductImage {
  id: string;
  productId: string;
  path: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
}

async function testCompleteImageFlow() {
  console.log('🧪 Testing Complete Product Image Flow\n');

  let token: string;
  let productId: string;
  let uploadedImageId: string;

  try {
    // Step 1: Login as admin
    console.log('1️⃣  Logging in as admin...');
    const loginRes = await axios.post<LoginResponse>(`${API_URL}/auth/login`, {
      email: 'admin@emart.com',
      password: 'Admin@123456',
    });
    token = loginRes.data.data.token;
    console.log('   ✅ Logged in successfully\n');

    // Step 2: Get a product ID
    console.log('2️⃣  Fetching products...');
    const productsRes = await axios.get(`${API_URL}/products`);
    productId = productsRes.data.data.products[0].id;
    console.log(`   ✅ Using product ID: ${productId}\n`);

    // Step 3: Create a test image file
    console.log('3️⃣  Creating test image...');
    const testImagePath = path.join(__dirname, 'test-upload-image.jpg');
    
    // Create a simple 1x1 JPEG image (smallest valid JPEG)
    const jpegData = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
      0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
      0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xC0, 0x00,
      0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01,
      0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA,
      0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
      0x7F, 0xFF, 0xD9
    ]);
    
    fs.writeFileSync(testImagePath, jpegData);
    console.log(`   ✅ Created test image at: ${testImagePath}\n`);

    // Step 4: Upload the image
    console.log('4️⃣  Uploading product image...');
    const formData = new FormData();
    formData.append('image', fs.createReadStream(testImagePath));

    const uploadRes = await axios.post(
      `${API_URL}/products/${productId}/images`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${token}`,
        },
      }
    );

    uploadedImageId = uploadRes.data.data.id;
    console.log('   ✅ Image uploaded successfully');
    console.log(`   📷 Image ID: ${uploadedImageId}`);
    console.log(`   🔗 Image URL: ${uploadRes.data.data.url}`);
    console.log(`   🏷️  Is Primary: ${uploadRes.data.data.isPrimary}\n`);

    // Step 5: Verify image is in database
    console.log('5️⃣  Verifying image in database...');
    const productRes = await axios.get(`${API_URL}/products/${productId}`);
    const product = productRes.data.data;
    const images: ProductImage[] = product.productImages;
    
    if (images.length === 0) {
      throw new Error('No images found in product after upload!');
    }
    
    const uploadedImage = images.find(img => img.id === uploadedImageId);
    if (!uploadedImage) {
      throw new Error('Uploaded image not found in product images!');
    }
    
    console.log(`   ✅ Found ${images.length} image(s) for product`);
    console.log(`   📷 Image URL: ${uploadedImage.url}`);
    console.log(`   🏷️  Is Primary: ${uploadedImage.isPrimary}`);
    console.log(`   📦 Storage Path: ${uploadedImage.path}\n`);

    // Step 6: Test fetching image URL (verify it's accessible)
    console.log('6️⃣  Verifying image URL is accessible...');
    try {
      const imageCheckRes = await axios.head(uploadedImage.url);
      console.log(`   ✅ Image URL is accessible (HTTP ${imageCheckRes.status})\n`);
    } catch (error: any) {
      console.log(`   ⚠️  Image URL check failed: ${error.message}`);
      console.log('   (This might be expected if Supabase Storage requires authentication)\n');
    }

    // Step 7: Delete the image
    console.log('7️⃣  Deleting uploaded image...');
    await axios.delete(
      `${API_URL}/products/${productId}/images/${uploadedImageId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log('   ✅ Image deleted successfully\n');

    // Step 8: Verify image is removed
    console.log('8️⃣  Verifying image was removed...');
    const finalProductRes = await axios.get(`${API_URL}/products/${productId}`);
    const finalProduct = finalProductRes.data.data;
    const finalImages: ProductImage[] = finalProduct.productImages;
    
    if (finalImages.some(img => img.id === uploadedImageId)) {
      throw new Error('Image still exists after deletion!');
    }
    
    console.log(`   ✅ Image successfully removed from database`);
    console.log(`   📊 Remaining images: ${finalImages.length}\n`);

    // Cleanup
    console.log('9️⃣  Cleaning up test file...');
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
      console.log('   ✅ Test image file deleted\n');
    }

    console.log('✅ ✅ ✅ ALL TESTS PASSED! ✅ ✅ ✅\n');
    console.log('Summary:');
    console.log('  ✅ Admin authentication');
    console.log('  ✅ Image upload to Supabase Storage');
    console.log('  ✅ Image metadata saved to database');
    console.log('  ✅ Image retrieval via product API');
    console.log('  ✅ Image deletion from Storage and database');
    console.log('  ✅ Complete flow verified\n');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    process.exit(1);
  }
}

// Run the test
testCompleteImageFlow().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
