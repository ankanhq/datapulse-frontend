export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-pulse-500/20 text-pulse-400">
            {/* simple pulse glyph */}
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h4l2 6 4-12 2 6h4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              DataPulse Analytics
            </h1>
            <p className="text-xs text-slate-400">Local analytics over millions of rows</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        DataPulse · DuckDB + FastAPI + React
      </footer>
    </div>
  );
}
