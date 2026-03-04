export default function Header() {
  return (
    <header className="bg-[#0A0A0A] text-white">
      <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 border border-[#C5A35E] flex items-center justify-center shrink-0">
            <span className="text-[#C5A35E] text-[10px] font-bold tracking-widest">BP</span>
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide leading-tight">BP Cuisine</p>
            <p className="text-[#C5A35E] text-[10px] tracking-[0.25em] uppercase leading-tight mt-0.5">
              Render Studio
            </p>
          </div>
        </div>

        <span className="text-[10px] text-neutral-600 tracking-[0.2em] uppercase hidden sm:block">
          Internal Tool
        </span>
      </div>
    </header>
  )
}
