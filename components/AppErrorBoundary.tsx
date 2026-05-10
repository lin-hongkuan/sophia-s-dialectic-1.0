import React from 'react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
  resetKey: string;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: AppErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Sophia] render error boundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="max-w-2xl mx-auto mt-16 bg-white/90 border border-red-100 rounded-xl p-8 text-center shadow-sm">
          <h2 className="font-serif text-3xl text-museum-900 mb-3">页面渲染遇到了问题</h2>
          <p className="text-museum-600 leading-relaxed mb-6">这次不会再白屏。请刷新页面后继续使用，如果刚才正在生成，完成结果会在 History 里保留。</p>
          <button type="button" onClick={() => window.location.reload()} className="px-6 py-3 bg-museum-900 text-museum-50 rounded-full font-serif hover:bg-black transition-colors">
            刷新页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
