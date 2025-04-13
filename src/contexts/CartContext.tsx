import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { getOrCreateAnonymousId } from '../utils/userIdentifier';

export interface CartItem {
  id: string;
  name: string;
  type: string;
  price: number;
  image: string;
  customDesign?: string;
  mockup2D?: string;
  customDesignPosition?: { x: number, y: number };
  customDesignZoom?: number;
  customTextElements?: any[];
  phoneName?: string;
  caseTypeName?: string;
  inventoryItemId: string;
  phoneModelId: string;
  caseTypeId: string;
  quantity: number;
  designId?: string;  // Unique ID to identify the design in storage
  anonymousUserId?: string; // ID người dùng ẩn danh từ cookie
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => Promise<void>;
  removeFromCart: (id: string) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  cartCount: number;
  totalItems: number;
  isLoading: boolean;
  error: string | null;
  clearCart: () => void;
  isMaxCartReached: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const MAX_CART_ITEMS = 10;
const MAX_IMAGE_SIZE = 50 * 1024; // 50KB limit for each image
const LOW_QUALITY_IMAGE_SIZE = 25 * 1024; // 25KB for low quality fallback
const CART_STORAGE_KEY = 'shopping_cart';
const CART_META_KEY = 'shopping_cart_meta';

// Storage options with fallbacks
enum StorageType {
  LocalStorage = 'localStorage',
  SessionStorage = 'sessionStorage',
  Memory = 'memory' // Last resort
}

// In-memory fallback storage when all else fails
const memoryStorage: Record<string, string> = {};

// Try to store data with fallbacks
const trySetStorage = (key: string, value: string): StorageType | null => {
  try {
    // Try localStorage first
    localStorage.setItem(key, value);
    return StorageType.LocalStorage;
  } catch (e) {
    try {
      // Try sessionStorage as fallback
      sessionStorage.setItem(key, value);
      return StorageType.SessionStorage;
    } catch (e) {
      try {
        // Last resort: in-memory storage
        memoryStorage[key] = value;
        return StorageType.Memory;
      } catch (e) {
        console.error('All storage methods failed:', e);
        return null;
      }
    }
  }
};

// Try to get data from any available storage
const tryGetStorage = (key: string): string | null => {
  try {
    // Try localStorage first
    const value = localStorage.getItem(key);
    if (value) return value;
  } catch (e) {}
  
  try {
    // Try sessionStorage next
    const value = sessionStorage.getItem(key);
    if (value) return value;
  } catch (e) {}
  
  // Finally try memory storage
  return memoryStorage[key] || null;
};

// Try to remove data from all storages
const tryRemoveStorage = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (e) {}
  
  try {
    sessionStorage.removeItem(key);
  } catch (e) {}
  
  // Also clean memory storage
  delete memoryStorage[key];
};

// Aggressively compress an image
const compressImage = async (base64Data: string, targetSize: number = MAX_IMAGE_SIZE): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      let quality = 0.7;
      let maxWidth = 800;
      let output: string;
      
      // Try with normal settings first
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Scale down large images first
        if (width > maxWidth) {
          height = Math.floor(height * (maxWidth / width));
          width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);
      
        // First attempt with reasonable quality
        output = canvas.toDataURL('image/jpeg', quality);
        
        // If still too large, continue reducing quality
        while (output.length > targetSize && quality > 0.1) {
          quality -= 0.1;
          output = canvas.toDataURL('image/jpeg', quality);
        }
        
        // If still too large, reduce dimensions and quality further
        if (output.length > targetSize) {
          // Try more aggressive compression
          maxWidth = 400; // Reduce to 400px width max
          if (width > maxWidth) {
            height = Math.floor(height * (maxWidth / width));
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);
          
          quality = 0.5; // Start with lower quality
          output = canvas.toDataURL('image/jpeg', quality);
          
          while (output.length > targetSize && quality > 0.1) {
            quality -= 0.1;
            output = canvas.toDataURL('image/jpeg', quality);
          }
      }
      
      resolve(output);
      } catch (e) {
        console.error('Error compressing image:', e);
        // Return original if compression fails
        resolve(base64Data);
      }
    };
    
    img.onerror = () => {
      console.error('Error loading image for compression');
      // Return original if loading fails
      resolve(base64Data);
    };
    
    img.src = base64Data;
  });
};

// Helper functions for localStorage management
const saveCartToLocalStorage = async (cart: CartItem[]) => {
  try {
    // Create a storage tracker to track where each image is stored
    const storageInfo: Record<string, {type: StorageType, isCompressed?: boolean}> = {};
    
    // Create a simplified version of the cart to save
    const cartToSave = await Promise.all(cart.map(async (item) => {
      // Create a copy of the item
      const itemCopy = { ...item };
      
      // Handle large base64 images - we'll save them separately
      if (itemCopy.image && itemCopy.image.startsWith('data:')) {
        try {
          // Try to compress the image first
          const compressedImage = await compressImage(itemCopy.image);
          
          // Create a storage key for this image
          const imageKey = `${CART_STORAGE_KEY}_img_${item.id}_image`;
          
          // Try to store the compressed image
          const storageType = trySetStorage(imageKey, compressedImage);
          
          if (storageType) {
            // Track where we stored it
            storageInfo[imageKey] = { type: storageType, isCompressed: true };
            itemCopy.image = `storage_ref:${imageKey}`;
          } else {
            // If all storage methods failed, use a URL if possible or leave alone
            if (!itemCopy.image.startsWith('http')) {
              itemCopy.image = 'image_storage_failed';
            }
          }
        } catch (e) {
          console.error('Error processing image for item', item.id, e);
          if (!itemCopy.image.startsWith('http')) {
            itemCopy.image = 'image_storage_failed';
          }
        }
      }
      
      // Handle customDesign with the same strategy
      if (itemCopy.customDesign && itemCopy.customDesign.startsWith('data:')) {
        try {
          const compressedDesign = await compressImage(itemCopy.customDesign);
          
          const designKey = `${CART_STORAGE_KEY}_img_${item.id}_customDesign`;
          const storageType = trySetStorage(designKey, compressedDesign);
          
          if (storageType) {
            storageInfo[designKey] = { type: storageType, isCompressed: true };
            itemCopy.customDesign = `storage_ref:${designKey}`;
          } else {
            itemCopy.customDesign = 'design_storage_failed';
          }
        } catch (e) {
          console.error('Error processing custom design for item', item.id, e);
          itemCopy.customDesign = 'design_storage_failed';
        }
      }
      
      // mockup2D is the largest and most important for user experience
      if (itemCopy.mockup2D && itemCopy.mockup2D.startsWith('data:')) {
        try {
          // Try normal compression first
          const compressedMockup = await compressImage(itemCopy.mockup2D);
          
          const mockupKey = `${CART_STORAGE_KEY}_img_${item.id}_mockup2D`;
          let storageType = trySetStorage(mockupKey, compressedMockup);
          
          // If that fails, try even more aggressive compression
          if (!storageType) {
            console.log('First compression attempt failed, trying low quality');
            const lowQualityMockup = await compressImage(itemCopy.mockup2D, LOW_QUALITY_IMAGE_SIZE);
            storageType = trySetStorage(mockupKey, lowQualityMockup);
          }
          
          if (storageType) {
            storageInfo[mockupKey] = { type: storageType, isCompressed: true };
            itemCopy.mockup2D = `storage_ref:${mockupKey}`;
          } else {
            itemCopy.mockup2D = 'mockup_storage_failed';
          }
        } catch (e) {
          console.error('Error processing mockup for item', item.id, e);
          itemCopy.mockup2D = 'mockup_storage_failed';
        }
      }
      
      return itemCopy;
    }));
    
    // Save the lightweight cart data
    const cartData = JSON.stringify(cartToSave);
    const cartStorageType = trySetStorage(CART_STORAGE_KEY, cartData);
    
    if (!cartStorageType) {
      console.error('Failed to save cart data to any storage');
    }
    
    // Save the storage metadata
    try {
      const metaData = JSON.stringify({
        storageInfo,
        lastUpdated: new Date().toISOString()
      });
      trySetStorage(CART_META_KEY, metaData);
    } catch (e) {
      console.error('Failed to save cart metadata', e);
    }
    
  } catch (error) {
    console.error('Error saving cart to storage:', error);
  }
};

const getCartFromLocalStorage = (): CartItem[] => {
  try {
    // Get the cart data
    const savedCart = tryGetStorage(CART_STORAGE_KEY);
    if (!savedCart) return [];
    
    const parsedCart = JSON.parse(savedCart);
    
    // Restore image references from available storage
    return parsedCart.map((item: CartItem) => {
      const restoredItem = { ...item };
      
      // Restore image if it's a storage reference
      if (item.image && item.image.startsWith('storage_ref:')) {
        const imageKey = item.image.substring(12); // Remove 'storage_ref:' prefix
        const storedImage = tryGetStorage(imageKey);
        if (storedImage) {
          restoredItem.image = storedImage;
        }
      }
      
      // Restore customDesign if it's a storage reference
      if (item.customDesign && item.customDesign.startsWith('storage_ref:')) {
        const designKey = item.customDesign.substring(12);
        const storedDesign = tryGetStorage(designKey);
        if (storedDesign) {
          restoredItem.customDesign = storedDesign;
        }
      }
      
      // Restore mockup2D if it's a storage reference
      if (item.mockup2D && item.mockup2D.startsWith('storage_ref:')) {
        const mockupKey = item.mockup2D.substring(12);
        const storedMockup = tryGetStorage(mockupKey);
        if (storedMockup) {
          restoredItem.mockup2D = storedMockup;
        }
      }
      
      return restoredItem;
    });
  } catch (error) {
    console.error('Error loading cart from storage:', error);
    return [];
  }
};

// Helper function to clear all cart-related items from storage
const clearCartStorage = () => {
  try {
    // Get metadata to know what to clean
    const metaData = tryGetStorage(CART_META_KEY);
    if (metaData) {
      try {
        const { storageInfo } = JSON.parse(metaData);
        // Clean up all image keys based on metadata
        Object.keys(storageInfo).forEach(key => {
          tryRemoveStorage(key);
        });
      } catch (e) {
        console.error('Error parsing cart metadata for cleanup', e);
      }
    }
    
    // Find cart-related keys in all storage types
    const keysToRemove: string[] = [];
    
    // Check localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key === CART_STORAGE_KEY || key === CART_META_KEY || key.startsWith(`${CART_STORAGE_KEY}_img_`))) {
          keysToRemove.push(key);
        }
      }
    } catch (e) {}
    
    // Check sessionStorage
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key === CART_STORAGE_KEY || key === CART_META_KEY || key.startsWith(`${CART_STORAGE_KEY}_img_`))) {
          if (!keysToRemove.includes(key)) {
            keysToRemove.push(key);
          }
        }
      }
    } catch (e) {}
    
    // Add any memory storage keys
    Object.keys(memoryStorage).forEach(key => {
      if (key === CART_STORAGE_KEY || key === CART_META_KEY || key.startsWith(`${CART_STORAGE_KEY}_img_`)) {
        if (!keysToRemove.includes(key)) {
          keysToRemove.push(key);
        }
      }
    });
    
    // Remove all keys
    keysToRemove.forEach(key => tryRemoveStorage(key));
    
    console.log(`Cleared ${keysToRemove.length} cart-related items from storage`);
  } catch (error) {
    console.error('Error clearing cart storage:', error);
  }
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    // Initialize from storage if available
    const cartItems = getCartFromLocalStorage();
    // Ensure all items have quantity property
    return cartItems.map((item: CartItem) => ({
      ...item,
      quantity: item.quantity || 1
    }));
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lấy hoặc tạo ID người dùng ẩn danh mỗi khi component được khởi tạo
  const anonymousUserId = getOrCreateAnonymousId();

  // Save to storage whenever items change
  useEffect(() => {
    const saveCart = async () => {
      await saveCartToLocalStorage(items);
    };
    saveCart();
  }, [items]);

  // Restore images that could not be saved to storage
  useEffect(() => {
    // This will run once after loading cart from storage
    const restoreMissingImages = async () => {
      // Only run if we have items
      if (items.length === 0) return;

      // Check if any items are missing images or have placeholder references
      const needsImageRestore = items.some(item => 
        !item.image || 
        item.image === 'image_storage_failed' ||
        !item.mockup2D || 
        item.mockup2D === 'mockup_storage_failed' ||
        (item.customDesign === 'design_storage_failed')
      );

      if (!needsImageRestore) return;

      try {
        setIsLoading(true);
        
        // Make a copy of items to update
        const updatedItems = [...items];
        
        // For each item that needs image restoration
        for (let i = 0; i < updatedItems.length; i++) {
          const item = updatedItems[i];
          
          // For standard case images, fetch from the case_types table if needed
          if (!item.image || item.image === 'image_storage_failed') {
            try {
              const { data: caseData } = await supabase
                .from('case_types')
                .select('image_url')
                .eq('id', item.caseTypeId)
                .single();
                
              if (caseData?.image_url) {
                updatedItems[i] = { ...item, image: caseData.image_url };
              }
            } catch (err) {
              console.error('Error fetching case image:', err);
            }
          }
          
          // For mockup images, check inventory_items table if needed
          if (!item.mockup2D || item.mockup2D === 'mockup_storage_failed') {
            try {
              const { data: inventoryData } = await supabase
                .from('inventory_items')
                .select('mockup_2d_path')
                .eq('id', item.inventoryItemId)
                .single();
                
              if (inventoryData?.mockup_2d_path) {
                updatedItems[i] = { ...item, mockup2D: inventoryData.mockup_2d_path };
              }
            } catch (err) {
              console.error('Error fetching mockup image:', err);
            }
          }
        }
        
        // Update the items with restored images
        if (JSON.stringify(updatedItems) !== JSON.stringify(items)) {
          setItems(updatedItems);
        }
      } catch (error) {
        console.error("Error restoring missing images:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    restoreMissingImages();
  }, []); // Empty dependency array means this runs once after initial load

  // Calculate cart count (unique items)
  const cartCount = items.length;
  
  // Calculate total items (including quantities)
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  
  // Check if max cart limit is reached
  const isMaxCartReached = cartCount >= MAX_CART_ITEMS;

  // Add item to cart
  const addToCart = async (item: CartItem) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if we've reached the maximum unique items limit
      // But exclude the case when we're updating an existing item
      const existingItemIndex = items.findIndex(i => i.id === item.id);
      const isUpdate = existingItemIndex >= 0;
      
      if (!isUpdate && isMaxCartReached) {
        throw new Error(`Cart is limited to ${MAX_CART_ITEMS} different items`);
      }
      
      // Ensure item has a quantity and anonymousUserId
      const itemWithQuantity = {
        ...item,
        quantity: item.quantity || 1,
        anonymousUserId: anonymousUserId // Thêm ID người dùng ẩn danh vào mỗi item
      };
      
      if (isUpdate) {
        // We're updating an existing item
        const existingItem = items[existingItemIndex];
        
        // We need to preserve the existing quantity and just update the design
        const updatedItem = {
          ...itemWithQuantity,
          quantity: existingItem.quantity // Keep the same quantity
        };
        
        // Update cart item with new design
        const updatedItems = [...items];
        updatedItems[existingItemIndex] = updatedItem;
        setItems(updatedItems);
        
        console.log("Updated existing cart item:", updatedItem);
      } else {
        // Look for items with the same designId (in case it's a re-upload)
        const designIdMatch = item.designId ? items.findIndex(i => i.designId === item.designId) : -1;
        
        if (designIdMatch >= 0) {
          // Update existing item with this designId
          const existingItem = items[designIdMatch];
          const updatedItems = [...items];
          updatedItems[designIdMatch] = {
            ...itemWithQuantity,
            quantity: existingItem.quantity // Preserve quantity
          };
          setItems(updatedItems);
        } else {
          // Add to cart as new item
          setItems(prev => [...prev, itemWithQuantity]);
        }
      }
    } catch (error: unknown) {
      // Handle the error in a type-safe way
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }
      
      setError(errorMessage);
      console.error('Error adding to cart:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Remove item from cart
  const removeFromCart = async (id: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Find the item to be removed
      const itemToRemove = items.find(item => item.id === id);
      
      if (itemToRemove) {
        // Delete design image files from Supabase storage
        try {
          // Check if this item has custom design or mockup images stored in Supabase
          if (itemToRemove.customDesign && itemToRemove.customDesign.startsWith('temp/')) {
            const { error } = await supabase.storage
              .from('case-assets')
              .remove([itemToRemove.customDesign]);
              
            if (error) {
              console.error('Error deleting custom design from storage:', error);
            } else {
              console.log(`Successfully deleted custom design: ${itemToRemove.customDesign}`);
            }
          }
          
          // Also delete mockup image if it exists
          if (itemToRemove.mockup2D && itemToRemove.mockup2D.startsWith('temp/')) {
            const { error } = await supabase.storage
              .from('case-assets')
              .remove([itemToRemove.mockup2D]);
              
            if (error) {
              console.error('Error deleting mockup image from storage:', error);
            } else {
              console.log(`Successfully deleted mockup image: ${itemToRemove.mockup2D}`);
            }
          }
        } catch (storageError) {
          console.error('Error deleting images from Supabase storage:', storageError);
          // Continue with cart removal even if storage deletion fails
        }
        
        // Remove any stored images for this item
        try {
          // Find all keys related to this item
          const itemPrefix = `${CART_STORAGE_KEY}_img_${id}_`;
          
          // Check localStorage
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.includes(itemPrefix)) {
                tryRemoveStorage(key);
              }
            }
          } catch (e) {}
          
          // Check sessionStorage
          try {
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              if (key && key.includes(itemPrefix)) {
                tryRemoveStorage(key);
              }
            }
          } catch (e) {}
          
          // Clean memory storage
          Object.keys(memoryStorage).forEach(key => {
            if (key.includes(itemPrefix)) {
              delete memoryStorage[key];
            }
          });
          
          console.log(`Removed stored images for item ${id}`);
        } catch (storageError) {
          console.error('Error cleaning up image storage:', storageError);
          // Continue with cart removal even if storage cleanup fails
        }
      }
      
      // Remove from cart
      setItems(prev => prev.filter(item => item.id !== id));
      
    } catch (error: unknown) {
      // Handle the error in a type-safe way
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }
      
      setError(errorMessage);
      console.error('Error removing from cart:', error);
      // Still remove from cart UI even if there was an error
      setItems(prev => prev.filter(item => item.id !== id));
    } finally {
      setIsLoading(false);
    }
  };

  // Update item quantity
  const updateQuantity = async (id: string, quantity: number) => {
    // Don't allow quantity less than 1
    if (quantity < 1) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const itemToUpdate = items.find(item => item.id === id);
      
      if (!itemToUpdate) {
        throw new Error('Item not found');
      }
      
      // Update the cart item
      setItems(prev => 
        prev.map(item => 
          item.id === id ? { ...item, quantity } : item
        )
      );
      
    } catch (error: unknown) {
      // Handle the error in a type-safe way
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }
      
      setError(errorMessage);
      console.error('Error updating quantity:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear cart function
  const clearCart = async () => {
    setIsLoading(true);
    
    try {
      // For each item in cart, delete their associated images in Supabase
      for (const item of items) {
        try {
          // Delete custom design if it exists in temp folder
          if (item.customDesign && item.customDesign.startsWith('temp/')) {
            const { error } = await supabase.storage
              .from('case-assets')
              .remove([item.customDesign]);
              
            if (error) {
              console.error(`Error deleting custom design for item ${item.id}:`, error);
            } else {
              console.log(`Successfully deleted custom design: ${item.customDesign}`);
            }
          }
          
          // Delete mockup image if it exists in temp folder
          if (item.mockup2D && item.mockup2D.startsWith('temp/')) {
            const { error } = await supabase.storage
              .from('case-assets')
              .remove([item.mockup2D]);
              
            if (error) {
              console.error(`Error deleting mockup image for item ${item.id}:`, error);
            } else {
              console.log(`Successfully deleted mockup image: ${item.mockup2D}`);
            }
          }
        } catch (itemError) {
          console.error(`Error processing images for item ${item.id}:`, itemError);
          // Continue with next item even if this one fails
        }
      }
      
      // Attempt to delete all files in the user's temp folder directory
      try {
        // Lấy danh sách tất cả các file trong thư mục temp của người dùng
        const { data: userFiles, error: listError } = await supabase.storage
          .from('case-assets')
          .list(`temp/${anonymousUserId}`);
          
        if (listError) {
          console.error('Error listing user files:', listError);
        } else if (userFiles && userFiles.length > 0) {
          // Create array of file paths to delete
          const filePaths = userFiles.map(file => `temp/${anonymousUserId}/${file.name}`);
          
          // Delete all files in the user's directory
          const { error: deleteError } = await supabase.storage
            .from('case-assets')
            .remove(filePaths);
            
          if (deleteError) {
            console.error('Error bulk deleting user files:', deleteError);
          } else {
            console.log(`Successfully deleted ${filePaths.length} files from user folder`);
          }
        }
      } catch (folderError) {
        console.error('Error cleaning up user folder:', folderError);
      }
      
      // Clear all cart storage
      clearCartStorage();
      
    } catch (error) {
      console.error('Error during cart clear:', error);
    } finally {
      // Always clear the cart
      setItems([]);
      setIsLoading(false);
    }
  };

  return (
    <CartContext.Provider value={{ 
      items, 
      addToCart, 
      removeFromCart,
      updateQuantity,
      cartCount,
      totalItems,
      isLoading, 
      error,
      clearCart,
      isMaxCartReached
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};