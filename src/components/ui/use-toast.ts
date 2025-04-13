import { useContext } from 'react';

type ToastVariant = 'default' | 'destructive' | 'success';

interface ToastProps {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

export function useToast() {
  // This is a simplified version. In a real app, you'd use a context or library.
  return {
    toast: ({ title, description, variant = 'default' }: ToastProps) => {
      console.log(`Toast [${variant}]: ${title}${description ? ` - ${description}` : ''}`);
      
      // Create temporary toast element
      const toastElement = document.createElement('div');
      toastElement.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-md transform transition-all duration-500 ease-in-out translate-y-0 opacity-100 ${
        variant === 'destructive' ? 'bg-red-50 text-red-600 border border-red-200' : 
        variant === 'success' ? 'bg-green-50 text-green-600 border border-green-200' :
        'bg-white text-gray-800 border border-gray-100'
      }`;
      
      const titleElement = document.createElement('h3');
      titleElement.className = 'font-semibold text-sm';
      titleElement.textContent = title;
      
      toastElement.appendChild(titleElement);
      
      if (description) {
        const descElement = document.createElement('p');
        descElement.className = 'text-xs mt-1';
        descElement.textContent = description;
        toastElement.appendChild(descElement);
      }
      
      document.body.appendChild(toastElement);
      
      // Animate in
      setTimeout(() => {
        if (toastElement) {
          toastElement.style.opacity = '1';
          toastElement.style.transform = 'translateY(0)';
        }
      }, 10);
      
      // Remove after 3 seconds
      setTimeout(() => {
        if (toastElement) {
          toastElement.style.opacity = '0';
          toastElement.style.transform = 'translateY(-20px)';
          
          setTimeout(() => {
            if (toastElement && toastElement.parentNode) {
              document.body.removeChild(toastElement);
            }
          }, 300);
        }
      }, 3000);
    }
  };
} 