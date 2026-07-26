import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

export function ToastViewport() {
  const { toasts, dismissToast } = useAppStore()
  return (
    <div className="toast-viewport" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.type}`} key={toast.id}>
          <div className="toast-icon">{toast.type === 'success' ? <CheckCircle2 size={20} /> : toast.type === 'error' ? <AlertCircle size={20} /> : <Info size={20} />}</div>
          <div><strong>{toast.title}</strong>{toast.message && <p>{toast.message}</p>}</div>
          <button onClick={() => dismissToast(toast.id)} aria-label="关闭提示"><X size={16} /></button>
        </div>
      ))}
    </div>
  )
}
