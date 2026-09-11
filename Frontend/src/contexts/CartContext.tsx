import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../lib/api';

interface CartContextType {
  cartCount: number;
  updateCartCount: (count: number) => void;
  refreshCartCount: () => Promise<void>;
  incrementCartCount: (amount?: number) => void;
  decrementCartCount: (amount?: number) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartCount, setCartCount] = useState(0);
  const { isAuthenticated, user } = useAuth();

  // Load cart count once on mount for authenticated users
  const refreshCartCount = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setCartCount(0);
      return;
    }

    try {
      const cart = await api.get<{ items?: Array<{ quantity?: number }> } | null>('/cart').catch(() => null);
      const items = Array.isArray(cart?.items) ? cart.items : [];
      const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      setCartCount(total);
    } catch {
      setCartCount(0);
    }
  }, [isAuthenticated, user]);

  // Initial load
  useEffect(() => {
    refreshCartCount();
  }, [refreshCartCount]);

  // Direct update (for optimistic updates)
  const updateCartCount = useCallback((count: number) => {
    setCartCount(Math.max(0, count));
  }, []);

  const incrementCartCount = useCallback((amount: number = 1) => {
    setCartCount((prev) => prev + amount);
  }, []);

  const decrementCartCount = useCallback((amount: number = 1) => {
    setCartCount((prev) => Math.max(0, prev - amount));
  }, []);

  // Listen to cart:updated custom events
  useEffect(() => {
    const handleCartUpdate = (event?: Event) => {
      const customEvent = event as CustomEvent<{ total?: number }> | undefined;
      const incomingTotal = customEvent?.detail?.total;
      if (typeof incomingTotal === 'number') {
        setCartCount(incomingTotal);
      } else {
        refreshCartCount();
      }
    };

    window.addEventListener('cart:updated', handleCartUpdate);
    return () => {
      window.removeEventListener('cart:updated', handleCartUpdate);
    };
  }, [refreshCartCount]);

  return (
    <CartContext.Provider
      value={{
        cartCount,
        updateCartCount,
        refreshCartCount,
        incrementCartCount,
        decrementCartCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
