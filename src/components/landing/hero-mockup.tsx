export function HeroMockup() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="overflow-hidden rounded-none border border-white/10 bg-white text-neutral-900 shadow-raised">
        <div className="flex items-center justify-between border-b border-neutral-200 bg-paper px-8 py-5">
          <p className="text-[14px] font-semibold">Master Services Agreement</p>
          <span className="rounded-none bg-brick-700/10 px-2.5 py-0.5 text-[10px] font-semibold text-brick-700">
            2 risks found
          </span>
        </div>
        <div className="flex min-h-[420px] flex-col justify-center gap-5 p-8 lg:p-10">
          <div className="rounded-none border border-neutral-200 p-6">
            <div className="flex items-center gap-2">
              <span className="rounded-none bg-brick-700/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brick-700">
                Critical
              </span>
              <p className="text-[13px] font-semibold">Section 8.4 — Uncapped indemnity</p>
            </div>
            <p className="mt-3 border-l-2 border-pine-500 pl-3 font-mono text-[12px] leading-relaxed text-neutral-700">
              &ldquo;…without limitation or cap, arising from any breach of this Agreement.&rdquo;
            </p>
          </div>
          <div className="rounded-none border border-neutral-200 bg-paper p-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-pine-700">
              Suggested counter-language
            </p>
            <p className="mt-2 font-mono text-[12px] leading-relaxed text-neutral-800">
              &ldquo;…subject to the aggregate liability cap in Section 9.&rdquo;
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-neutral-200 bg-paper px-8 py-4">
          <p className="text-[11px] text-neutral-500">
            Every finding traced to its source clause
          </p>
          <p className="text-[11px] font-semibold text-pine-700">Review full report</p>
        </div>
      </div>
    </div>
  )
}
