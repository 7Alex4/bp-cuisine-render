import Link from 'next/link'

export default function Header() {
  return (
    <header className="h-20 bg-white border-b border-[#EEEEEE] sticky top-0 z-40">
      <div className="max-w-[1280px] mx-auto h-full px-6 sm:px-10 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 bg-[#E30613] flex items-center justify-center rounded-sm shrink-0">
            <span className="text-white text-[11px] font-bold tracking-widest">BP</span>
          </div>
          <span className="text-[#111111] font-semibold text-[15px] tracking-tight hidden sm:block">
            BP Cuisines
          </span>
        </Link>

        <nav className="flex items-center gap-3">
          <Link
            href="/studio"
            className="rounded-full border border-[#e3d9cb] px-4 py-2 text-xs font-semibold text-[#201d1e] hover:border-[#c9b6a1]"
          >
            Studio 3D
          </Link>
          <Link
            href="/"
            className="rounded-full border border-[#e3d9cb] px-4 py-2 text-xs font-semibold text-[#201d1e] hover:border-[#c9b6a1]"
          >
            Render IA legacy
          </Link>
        </nav>

        <span className="hidden sm:block text-[11px] text-[#AAAAAA] tracking-[0.15em] uppercase shrink-0">
          Powered by Nexaia
        </span>
      </div>
    </header>
  )
}
