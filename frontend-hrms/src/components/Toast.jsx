import { createContext, useContext, useMemo } from 'react';
import Swal from 'sweetalert2';

const ToastContext = createContext();
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const value = useMemo(() => ({
    success: (message) => Swal.fire({ icon: 'success', title: message, timer: 2500, showConfirmButton: false, position: 'top-end', toast: true }),
    error: (message) => Swal.fire({ icon: 'error', title: message, timer: 3500, showConfirmButton: false, position: 'top-end', toast: true }),
    info: (message) => Swal.fire({ icon: 'info', title: message, timer: 2500, showConfirmButton: false, position: 'top-end', toast: true }),
    warning: (message) => Swal.fire({ icon: 'warning', title: message, timer: 3000, showConfirmButton: false, position: 'top-end', toast: true }),
  }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}
