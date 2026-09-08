"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const env_1 = __importDefault(require("../src/config/env"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Starting database seed...\n');
    const hashedPassword = await bcrypt_1.default.hash(env_1.default.admin.password, 10);
    const admin = await prisma.user.upsert({
        where: { email: env_1.default.admin.email },
        update: {},
        create: {
            email: env_1.default.admin.email,
            password: hashedPassword,
            firstName: 'Admin',
            lastName: 'User',
            role: 'ADMIN',
        },
    });
    console.log('✅ Admin user created:', admin.email);
    await prisma.cart.upsert({
        where: { userId: admin.id },
        update: {},
        create: { userId: admin.id },
    });
    const categories = [
        { name: 'Electronics', icon: 'smartphone', count: 248593, color: 'bg-blue-50 text-blue-600' },
        { name: 'Fashion', icon: 'shirt', count: 189432, color: 'bg-rose-50 text-rose-600' },
        { name: 'Watches', icon: 'watch', count: 67821, color: 'bg-amber-50 text-amber-600' },
        { name: 'Collectibles', icon: 'star', count: 95672, color: 'bg-purple-50 text-purple-600' },
        { name: 'Anime & Figures', icon: 'gamepad-2', count: 156890, color: 'bg-pink-50 text-pink-600' },
        { name: 'Beauty & Cosmetics', icon: 'sparkles', count: 124567, color: 'bg-fuchsia-50 text-fuchsia-600' },
        { name: 'Home & Living', icon: 'home', count: 89234, color: 'bg-emerald-50 text-emerald-600' },
        { name: 'Sports & Outdoors', icon: 'dumbbell', count: 73421, color: 'bg-teal-50 text-teal-600' },
    ];
    const createdCategories = [];
    for (const category of categories) {
        const created = await prisma.category.upsert({
            where: { name: category.name },
            update: {},
            create: category,
        });
        createdCategories.push(created);
    }
    console.log(`✅ Created ${createdCategories.length} categories\n`);
    const electronicsCategory = createdCategories.find(c => c.name === 'Electronics');
    const watchesCategory = createdCategories.find(c => c.name === 'Watches');
    const figuresCategory = createdCategories.find(c => c.name === 'Anime & Figures');
    const beautyCategory = createdCategories.find(c => c.name === 'Beauty & Cosmetics');
    const fashionCategory = createdCategories.find(c => c.name === 'Fashion');
    const homeCategory = createdCategories.find(c => c.name === 'Home & Living');
    const sportsCategory = createdCategories.find(c => c.name === 'Sports & Outdoors');
    const collectiblesCategory = createdCategories.find(c => c.name === 'Collectibles');
    const products = [
        {
            name: 'Vintage Seiko Automatic Chronograph Watch - Silver Dial',
            description: 'A beautiful vintage Seiko chronograph with automatic movement. Featuring a stunning silver sunburst dial with applied indices, this timepiece is in excellent working condition. Recently serviced and comes with original box.',
            image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=600&h=600&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800&h=800&fit=crop',
                'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&h=800&fit=crop',
                'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=800&h=800&fit=crop',
            ],
            price: 45000,
            estimatedPriceUsd: 310,
            condition: 'VERY_GOOD',
            seller: 'Watch Collector',
            sellerType: 'INDIVIDUAL',
            source: 'Marketplace A',
            domesticShipping: 520,
            internationalShippingUsd: 18,
            serviceFee: 3150,
            categoryId: watchesCategory.id,
            tags: ['Vintage', 'Seiko', 'Automatic', 'Chronograph'],
            isBestSeller: true,
            rating: 4.9,
            reviewCount: 127,
            stock: 1,
        },
        {
            name: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones - Black',
            description: 'Industry-leading noise cancellation with the new Integrated Processor V1 and QN1 HD processor. 8 mic system for unprecedented call quality. Up to 30 hours of battery life with quick charging.',
            image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&h=600&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&h=800&fit=crop',
                'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop',
            ],
            price: 38880,
            estimatedPriceUsd: 268,
            condition: 'NEW',
            seller: 'Electronics Official Store',
            sellerType: 'SHOP',
            source: 'Marketplace C',
            domesticShipping: 0,
            internationalShippingUsd: 22,
            serviceFee: 2722,
            categoryId: electronicsCategory.id,
            tags: ['Sony', 'Headphones', 'Wireless', 'Noise Cancelling'],
            isNew: true,
            rating: 4.8,
            reviewCount: 2891,
            stock: 15,
        },
        {
            name: 'Studio Ghibli My Neighbor Totoro - Large Plush Doll Authentic',
            description: 'Authentic Studio Ghibli large Totoro plush doll. Made with high quality soft materials. Official licensed product with hologram tag. Approximately 60cm tall.',
            image: 'https://images.unsplash.com/photo-1530325553241-4f6e7690cf36?w=600&h=600&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1530325553241-4f6e7690cf36?w=800&h=800&fit=crop',
            ],
            price: 8900,
            estimatedPriceUsd: 62,
            condition: 'NEW',
            seller: 'Anime Official Store',
            sellerType: 'SHOP',
            source: 'Marketplace D',
            domesticShipping: 300,
            internationalShippingUsd: 15,
            serviceFee: 623,
            categoryId: figuresCategory.id,
            tags: ['Studio Ghibli', 'Totoro', 'Plush', 'Authentic'],
            isBestSeller: true,
            rating: 5.0,
            reviewCount: 682,
            stock: 8,
        },
        {
            name: 'Shiseido Elixir Superieur Lifting Moisture Cream 45g',
            description: 'Shiseido Elixir Superieur anti-aging moisture cream with concentrated collagen and hyaluronic acid. For radiant, firmer skin with long-lasting hydration.',
            image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=600&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&h=800&fit=crop',
            ],
            price: 6600,
            estimatedPriceUsd: 46,
            condition: 'NEW',
            seller: 'Beauty Official Store',
            sellerType: 'SHOP',
            source: 'Marketplace E',
            domesticShipping: 220,
            internationalShippingUsd: 12,
            serviceFee: 462,
            categoryId: beautyCategory.id,
            tags: ['Shiseido', 'Skincare', 'Anti-Aging', 'Beauty'],
            rating: 4.7,
            reviewCount: 1543,
            stock: 25,
        },
        {
            name: 'Uniqlo U Lemaire Oversized Wool Blend Coat - Camel',
            description: 'Uniqlo U Lemaire collaboration wool blend oversized coat. Premium wool blend fabric with beautiful drape. Timeless camel color, size M. Worn once, like new condition.',
            image: 'https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=600&h=600&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=800&h=800&fit=crop',
            ],
            price: 12900,
            estimatedPriceUsd: 89,
            condition: 'LIKE_NEW',
            seller: 'Fashion Store',
            sellerType: 'SHOP',
            source: 'Marketplace A',
            domesticShipping: 800,
            internationalShippingUsd: 32,
            serviceFee: 903,
            categoryId: fashionCategory.id,
            tags: ['Uniqlo', 'Lemaire', 'Wool Coat', 'Designer'],
            rating: 4.6,
            reviewCount: 89,
            stock: 3,
        },
        {
            name: 'MUJI Wooden Bedside Table - Oak Wood Minimalist Design',
            description: 'Beautiful MUJI solid oak bedside table. Minimalist design with one drawer. Natural oak finish. Assembled size: W45 × D40 × H55cm.',
            image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=600&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=800&fit=crop',
            ],
            price: 7990,
            estimatedPriceUsd: 55,
            condition: 'VERY_GOOD',
            seller: 'Home Goods',
            sellerType: 'SHOP',
            source: 'Marketplace B',
            domesticShipping: 1200,
            internationalShippingUsd: 45,
            serviceFee: 559,
            categoryId: homeCategory.id,
            tags: ['MUJI', 'Oak Wood', 'Furniture', 'Minimalist'],
            rating: 4.5,
            reviewCount: 267,
            stock: 5,
        },
        {
            name: 'ASICS GEL-KAYANO 30 Running Shoes - White Blue',
            description: '30th anniversary edition of ASICS flagship stability running shoe. Featuring FF Blast Plus Eco cushioning and Dynamic Duomax support system.',
            image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=800&fit=crop',
            ],
            price: 19800,
            estimatedPriceUsd: 137,
            condition: 'NEW',
            seller: 'Sports Lab Official',
            sellerType: 'SHOP',
            source: 'Marketplace C',
            domesticShipping: 500,
            internationalShippingUsd: 28,
            serviceFee: 1386,
            categoryId: sportsCategory.id,
            tags: ['ASICS', 'Running', 'Sports Shoes', 'Kayano'],
            isNew: true,
            rating: 4.8,
            reviewCount: 478,
            stock: 20,
        },
        {
            name: 'Pokemon Center Limited Edition Charizard VMAX Card - Sealed',
            description: 'Rare limited edition Charizard VMAX full art holo card. Factory sealed in original sleeve and top loader. Gem Mint condition. Perfect for collectors.',
            image: 'https://images.unsplash.com/photo-1606728035253-49e8a23146de?w=600&h=600&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1606728035253-49e8a23146de?w=800&h=800&fit=crop',
            ],
            price: 78000,
            estimatedPriceUsd: 538,
            condition: 'LIKE_NEW',
            seller: 'Card Master',
            sellerType: 'INDIVIDUAL',
            source: 'Marketplace A',
            domesticShipping: 210,
            internationalShippingUsd: 14,
            serviceFee: 5460,
            categoryId: collectiblesCategory.id,
            tags: ['Pokemon', 'Charizard', 'Trading Cards', 'Rare'],
            isBestSeller: true,
            rating: 4.9,
            reviewCount: 56,
            stock: 1,
        },
    ];
    for (const product of products) {
        await prisma.product.create({
            data: product,
        });
    }
    console.log(`✅ Created ${products.length} products\n`);
    console.log('🎉 Database seed completed successfully!');
    console.log('\n📝 Login credentials:');
    console.log(`   Email: ${env_1.default.admin.email}`);
    console.log(`   Password: ${env_1.default.admin.password}\n`);
}
main()
    .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map