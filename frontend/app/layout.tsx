import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BESS Modelagem — Utility',
  description: 'Ferramenta de modelagem técnico-financeira de sistemas de armazenamento em bateria (BESS).',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
