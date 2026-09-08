# 3D Product Carousel Implementation

## Overview
A premium 3D product carousel built with React Three Fiber (R3F) and Three.js, featuring Japanese shopping products in an immersive, interactive WebGL-powered carousel on the EMART homepage hero section.

## Features Implemented

### ✨ Core Features
- **Premium 3D WebGL Carousel**: Real 3D rendering using React Three Fiber
- **6 Japanese Products**: Sneakers, camera, headphones, gaming console, collectibles, and watch
- **Smooth Drag/Swipe Controls**: Horizontal rotation with mouse drag and touch swipe support
- **Auto-rotation Mode**: Elegant automatic rotation with pause/play control
- **Hover Effects**: Dynamic scaling, glow effects, and subtle animations on hover
- **Floating Animation**: Gentle vertical movement for each product card
- **Responsive Design**: Adapts to desktop, tablet, and mobile viewports
- **Performance Optimized**: High-performance rendering with adaptive pixel ratio
- **WebGL Fallback**: Graceful degradation for devices without WebGL support

### 🎨 Visual Enhancements
- **Depth & Perspective**: Realistic 3D depth with proper camera positioning
- **Dynamic Lighting**: 
  - Central spotlight for dramatic effect
  - Ambient lighting for overall illumination
  - Rim lights (blue and amber) for visual interest
  - Per-card glow effect on hover
- **Shadows**: Proper shadow casting and receiving for realism
- **Reflective Floor**: Semi-transparent metallic floor plane for premium feel
- **Environment Mapping**: City environment preset for realistic reflections
- **Smooth Transitions**: Lerped animations for buttery-smooth interactions

### 📱 Responsive Behavior
- **Desktop (lg+)**: Full-size carousel with 8-unit camera distance, larger radius
- **Tablet (md)**: Medium-sized carousel with adjusted camera and radius
- **Mobile (<768px)**: Compact carousel with closer camera (6 units), smaller radius, touch-optimized controls

### ♿ Accessibility & Performance
- **WebGL Detection**: Automatic fallback to 2D carousel if WebGL unavailable
- **Touch Support**: Full swipe gesture support for mobile devices
- **Performance Modes**: 
  - Adaptive pixel ratio (1x to 2x based on device)
  - High-performance power preference for WebGL context
  - React.memo optimization for ProductCard3D components
- **Texture Loading**: Graceful error handling for failed image loads

## Technical Stack

### Dependencies Installed
```json
{
  "@react-three/fiber": "^8.15.12",  // React 18 compatible version
  "@react-three/drei": "^9.88.17",   // React 18 compatible version
  "three": "^0.160.0",
  "@types/three": "^0.x" (dev)
}
```

**Note**: React Three Fiber v9+ requires React 19. Since this project uses React 18, we use v8.15.12 which is fully compatible with React 18.

### Key Technologies
- **React Three Fiber (R3F)**: React renderer for Three.js
- **@react-three/drei**: Useful helpers (Html, Environment, useTexture)
- **Three.js**: WebGL 3D library
- **TypeScript**: Type-safe implementation
- **Tailwind CSS**: Styling for UI overlays

## File Structure

```
Frontend/
├── src/
│   ├── components/
│   │   └── 3d/
│   │       ├── ProductCarousel.tsx    # Main 3D carousel component
│   │       ├── FloatingProducts.tsx   # (existing)
│   │       └── GlobeScene.tsx         # (existing)
│   ├── pages/
│   │   └── Home.tsx                   # Updated to show carousel on hero
│   └── data/
│       └── mockData.ts                # Product data
└── package.json
```

## Component Architecture

### ProductCarousel (Main Component)
- State management for rotation, dragging, auto-rotate
- WebGL support detection
- Mobile device detection
- Event handlers for mouse/touch interactions
- Canvas configuration and rendering

### CarouselScene
- Group container for all 3D objects
- Product positioning in circular layout
- Lighting setup (spotlight, ambient, rim lights)
- Reflective floor plane
- Auto-rotation and manual rotation logic

### ProductCard3D (Memoized)
- Individual 3D product card mesh
- Texture mapping from product images
- Hover state with scale and glow effects
- Floating animation per card
- HTML overlay for product info (name, price)

### FallbackCarousel
- 2D carousel for non-WebGL devices
- Auto-advancing slideshow
- Navigation dots
- Graceful degradation

## Integration Points

### Home.tsx Hero Section
The carousel is integrated into the homepage hero as the right column:

```tsx
{/* Right Column - 3D Carousel */}
<div className="relative h-[400px] md:h-[450px] lg:h-[500px] flex items-center justify-center animate-fade-in">
  <ProductCarousel />
</div>
```

**Layout**: Two-column grid with search/CTA on left, 3D carousel on right
**Visibility**: Responsive on all devices (previously hidden on mobile)
**Animation**: Fade-in with 300ms delay for smooth page load

## Usage

### Running the Development Server
```bash
cd Frontend
npm run dev
```

### Building for Production
```bash
cd Frontend
npm run build
```

### Preview Production Build
```bash
cd Frontend
npm run preview
```

## Customization Guide

### Adjusting Products
Edit the `products` array in `ProductCarousel.tsx`:
```typescript
const products: Product[] = [
  {
    id: '1',
    name: 'Product Name',
    image: 'https://image-url.jpg',
    price: '¥24,800',
    category: 'Category',
  },
  // Add more products...
]
```

### Modifying Carousel Radius
In `CarouselScene` component:
```typescript
const baseRadius = isMobile ? 2.5 : Math.min(viewport.width * 0.8, 4)
const radius = Math.max(baseRadius, 2)
```

### Changing Rotation Speed
Auto-rotation speed in `CarouselScene`:
```typescript
groupRef.current.rotation.y += delta * 0.15 // Adjust 0.15 for speed
```

Manual rotation sensitivity in `ProductCarousel`:
```typescript
const sensitivity = isMobile ? 150 : 100 // Lower = more sensitive
```

### Adjusting Lighting
Modify light intensity and colors in `CarouselScene`:
```typescript
<spotLight intensity={0.5} />
<ambientLight intensity={0.4} />
<pointLight intensity={0.3} color="#a5b4fc" />
```

### Card Dimensions
Change card size in `ProductCard3D`:
```typescript
<boxGeometry args={[1.5, 2, 0.1]} /> // width, height, depth
```

### Camera Position
Adjust camera in `Canvas` component:
```typescript
camera={{ 
  position: isMobile ? [0, 0, 6] : [0, 0, 8], 
  fov: isMobile ? 60 : 50 
}}
```

## Performance Considerations

### Optimizations Applied
1. **Adaptive Pixel Ratio**: `dpr={[1, 2]}` - scales between 1x and 2x based on device
2. **High-Performance Mode**: `powerPreference: 'high-performance'` in WebGL context
3. **Component Memoization**: `React.memo` on ProductCard3D to prevent unnecessary re-renders
4. **Texture Caching**: useTexture from @react-three/drei handles caching automatically
5. **Conditional Rendering**: Auto-rotate toggle prevents unnecessary frame calculations
6. **Lerp Animations**: Smooth interpolation instead of direct value changes

### Performance Tips
- Keep product count under 10 for optimal performance
- Use optimized images (WebP format, reasonable dimensions)
- Reduce shadow map size if experiencing lag: `shadow-mapSize-width={512}`
- Disable shadows on mobile if needed
- Consider lazy-loading the 3D carousel component

## Browser Compatibility

### Supported Browsers
- ✅ Chrome/Edge 90+ (full WebGL support)
- ✅ Firefox 88+ (full WebGL support)
- ✅ Safari 14+ (full WebGL support)
- ✅ Mobile Safari iOS 14+ (touch controls)
- ✅ Chrome Android (touch controls)

### Fallback Support
- Older browsers without WebGL automatically receive 2D slideshow
- Touch events polyfilled where needed
- Pointer events used for unified mouse/touch handling

## Known Issues & Limitations

### Current Limitations
1. **Bundle Size**: Three.js and R3F add ~400KB gzipped to bundle
   - Consider code-splitting if needed: `const ProductCarousel = lazy(() => import('./components/3d/ProductCarousel'))`

2. **Mobile Performance**: Some low-end devices may experience reduced framerates
   - Fallback carousel activates automatically on WebGL-unsupported devices
   - Consider detecting GPU tier and adjusting quality

3. **Initial Load Time**: Textures load asynchronously
   - Images appear as white cards until loaded
   - Could add loading placeholder or skeleton

### Potential Enhancements
- [ ] Add click-through to product detail pages
- [ ] Implement product selection indicator
- [ ] Add sound effects for interactions (optional)
- [ ] Create admin panel to manage products
- [ ] Add analytics tracking for carousel interactions
- [ ] Implement A/B testing framework
- [ ] Add keyboard navigation (arrow keys)
- [ ] Create video tutorial for customization

## Troubleshooting

### Carousel Not Appearing
1. Check browser console for WebGL errors
2. Verify Three.js packages installed: `npm list three @react-three/fiber @react-three/drei`
3. Ensure component is properly imported in Home.tsx
4. Check for CSS conflicts hiding the carousel container

### Poor Performance
1. Reduce shadow quality or disable shadows
2. Lower pixel ratio: `dpr={1}`
3. Reduce number of products in carousel
4. Optimize product images (smaller file size)
5. Check browser hardware acceleration is enabled

### Images Not Loading
1. Verify image URLs are accessible
2. Check CORS headers if loading from external domain
3. Use HTTPS URLs (HTTP may be blocked)
4. Add error boundary to catch texture load failures

### Touch Controls Not Working
1. Ensure `touch-action: none` is applied (handled by `touch-none` class)
2. Verify pointer events are not being intercepted by parent elements
3. Check mobile browser console for touch event errors

## Credits & Resources

### Libraries Used
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/) - React renderer for Three.js
- [Three.js](https://threejs.org/) - JavaScript 3D library
- [@react-three/drei](https://github.com/pmndrs/drei) - Useful helpers for R3F
- [Unsplash](https://unsplash.com/) - Product images

### Learning Resources
- [R3F Documentation](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction)
- [Three.js Fundamentals](https://threejs.org/manual/)
- [Drei Examples](https://github.com/pmndrs/drei#readme)

## Support

For issues or questions:
1. Check this documentation first
2. Review browser console for errors
3. Verify all dependencies are installed
4. Check that WebGL is supported in your browser
5. Test in a different browser to isolate the issue

## Version History

### v1.0.0 (Current)
- Initial implementation with React Three Fiber
- 6 product carousel with drag/swipe controls
- Auto-rotation feature
- Responsive design (desktop, tablet, mobile)
- WebGL fallback carousel
- Performance optimizations
- Full TypeScript support
