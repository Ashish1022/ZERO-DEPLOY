export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <a href="/" className="mb-8 flex items-center gap-2 text-sm font-semibold tracking-tight">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <polygon points="10,2 18,16 2,16" />
        </svg>
        Zero Deploy
      </a>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
