import type { Metadata } from 'next'
import './globals.css'

// next/font/google is intentionally NOT used here: it downloads Inter from
// Google's CDN at build time, which fails in offline/CI environments.
// The font stack in globals.css uses system UI fonts that closely approximate
// Inter on all major platforms (Segoe UI Variable on Win11, SF Pro on macOS).

export const metadata: Metadata = {
  title: 'BP Cuisines - Kitchen AI Render Studio',
  description: 'BP Cuisines - Generez des rendus 4K de cuisines en quelques secondes grace a l\'IA.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      {/* Explicit charset declared first so browsers never auto-detect Latin-1 */}
      <head>
        <meta charSet="utf-8" />
      </head>
      <body>{children}</body>
    </html>
  )
}
