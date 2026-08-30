import { StrictMode, Component, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean; error: any}> {
  state = { hasError: false, error: null as any }
  static getDerivedStateFromError(error: any) { return { hasError: true, error } }
  componentDidCatch(error: any, info: any) { console.error('UI error boundary', error, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center p-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-lg w-full text-center">
            <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-600">!</div>
            <div className="text-sm font-semibold mt-3">Something went wrong</div>
            <div className="text-xs text-slate-500 mt-1">{String(this.state.error?.message || this.state.error).slice(0,300)}</div>
            <button onClick={()=> window.location.reload()} className="mt-4 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">Reload</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
