import './globals.css';

export const metadata = {
  title: 'PepeDrip — Real Rewards for Real Holders',
  description: 'Pump.fun rewards flippers. We reward holders. 100% of creator fees redistributed to diamond hands.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-dark-900">{children}</body>
    </html>
  );
}
