# EMART 3D Showcase - Customization Guide

## Quick Customization Reference

### Change Product Colors

Open `src/components/3d/FloatingProducts.tsx` and find the product you want to modify:

```tsx
// Camera (currently slate/gray)
<div className="bg-gradient-to-br from-slate-700 to-slate-900">
  
// Change to blue:
<div className="bg-gradient-to-br from-blue-700 to-blue-900">

// Or green:
<div className="bg-gradient-to-br from-green-700 to-green-900">
```

### Available Tailwind Colors
- `slate`, `gray`, `zinc`, `neutral`, `stone`
- `red`, `orange`, `amber`, `yellow`, `lime`
- `green`, `emerald`, `teal`, `cyan`, `sky`
- `blue`, `indigo`, `violet`, `purple`, `fuchsia`
- `pink`, `rose`

### Change Badge Colors

```tsx
// Current badges:
<div className="bg-red-500">NEW</div>
<div className="bg-orange-500">HOT</div>
<div className="bg-blue-500">SALE</div>
<div className="bg-yellow-500">⭐</div>
<div className="bg-purple-500">RARE</div>

// Custom badge:
<div className="bg-green-500">DEAL</div>
```

### Adjust Floating Speed

```tsx
// Slow floating (calm)
animation: 'float 10s ease-in-out infinite'

// Medium floating (default)
animation: 'float 6s ease-in-out infinite'

// Fast floating (energetic)
animation: 'float 3s ease-in-out infinite'
```

### Change Animation Timing

Each product has an `animationDelay`:

```tsx
animationDelay: '0s'  // Starts immediately
animationDelay: '1s'  // Starts after 1 second
animationDelay: '2s'  // Starts after 2 seconds
```

### Modify 3D Perspective

```tsx
// Subtle 3D (less dramatic)
transform: 'perspective(2000px) rotateY(-10deg) translateZ(10px)'

// Strong 3D (more dramatic) - default
transform: 'perspective(1000px) rotateY(-15deg) translateZ(20px)'

// Extreme 3D (very dramatic)
transform: 'perspective(500px) rotateY(-25deg) translateZ(40px)'
```

### Change Product Icons

Replace the icon component:

```tsx
import { Camera, Headphones, Gamepad2, Watch, Package, 
         ShoppingBag, Gift, Star, Heart, Sparkles } from 'lucide-react'

// Current:
<Camera className="w-12 h-12 text-white" />

// Change to:
<ShoppingBag className="w-12 h-12 text-white" />
<Gift className="w-12 h-12 text-white" />
<Star className="w-12 h-12 text-white" />
```

[See all icons at: https://lucide.dev/icons/](https://lucide.dev/icons/)

### Add More Products

Copy an existing product div and modify:

```tsx
<div 
  className="group relative"
  style={{
    transform: 'perspective(1000px) rotateY(10deg) translateZ(15px)',
    animation: 'float 6s ease-in-out infinite',
    animationDelay: '5s'  // Unique timing
  }}
>
  <div className="relative bg-white rounded-2xl p-8 shadow-2xl border border-gray-100">
    <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
      NEW PRODUCT
    </div>
    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-emerald-500 to-green-700 rounded-2xl flex items-center justify-center shadow-xl">
      <YourIcon className="w-12 h-12 text-white" />
    </div>
    <div className="mt-4 text-center">
      <div className="text-sm font-bold text-gray-800">Product Name</div>
      <div className="text-xs text-gray-500 mt-1">¥XX,XXX</div>
    </div>
  </div>
</div>
```

### Change Grid Layout

```tsx
// Current: 3 columns with specific positioning
<div className="grid grid-cols-3 gap-8 max-w-4xl">

// 2 columns (larger products)
<div className="grid grid-cols-2 gap-8 max-w-3xl">

// 4 columns (more products)
<div className="grid grid-cols-4 gap-6 max-w-5xl">

// Single row
<div className="flex gap-8 max-w-6xl overflow-x-auto">
```

### Modify Background

```tsx
// Current gradient
<div className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30">

// Warmer colors
<div className="bg-gradient-to-br from-orange-50 via-red-50/30 to-pink-50/30">

// Cooler colors
<div className="bg-gradient-to-br from-blue-50 via-cyan-50/30 to-teal-50/30">

// Solid color
<div className="bg-gray-50">
```

### Change Hover Effects

```tsx
// Current scale (5% larger)
hover:scale-105

// Subtle (2% larger)
hover:scale-102

// Dramatic (10% larger)
hover:scale-110
```

### Adjust Shadow Intensity

```tsx
// Light shadow
shadow-lg

// Medium shadow (default)
shadow-2xl

// Heavy shadow
shadow-2xl ring-4 ring-black/5
```

### Status Indicator Colors

At the bottom of the component:

```tsx
// Live indicator (green)
<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />

// Change to:
<div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
<div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
<div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
```

### Complete Example: Add a Sneaker Product

```tsx
{/* Sneaker - New Product */}
<div 
  className="group relative col-start-2"
  style={{
    transform: 'perspective(1000px) translateZ(30px)',
    animation: 'float 6s ease-in-out infinite',
    animationDelay: '2.5s'
  }}
>
  <div className="relative bg-white rounded-2xl p-8 shadow-2xl border border-gray-100 transition-all duration-500 hover:shadow-3xl hover:scale-105">
    <div className="absolute -top-2 -right-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
      LIMITED
    </div>
    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-xl transform group-hover:rotate-12 transition-transform duration-500">
      <ShoppingBag className="w-12 h-12 text-white" />
    </div>
    <div className="mt-4 text-center">
      <div className="text-sm font-bold text-gray-800">Sneakers</div>
      <div className="text-xs text-gray-500 mt-1">¥15,000</div>
    </div>
  </div>
</div>
```

## Tips & Best Practices

### Performance
- Keep animations under 10s duration
- Limit products to 5-7 visible at once
- Use transform for animations (GPU accelerated)
- Avoid animating width/height (causes reflows)

### Visual Harmony
- Use gradient shades from same color family
- Keep badge colors distinct and meaningful
- Maintain consistent spacing (gap-6 to gap-8)
- Use same animation timing across similar products

### Accessibility
- Ensure color contrast meets WCAG AA
- Keep text readable (12px minimum)
- Provide hover feedback
- Consider adding aria-labels for products

### Responsive Design
- Test on mobile (< 768px)
- Consider stacking on small screens
- Adjust grid columns for tablets
- Hide decorative elements if needed

## Need Help?

1. Check Tailwind CSS docs: https://tailwindcss.com/docs
2. Browse Lucide icons: https://lucide.dev/icons/
3. CSS Tricks for animations: https://css-tricks.com/
4. Test in browser DevTools

Happy customizing! 🎨
