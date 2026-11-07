import "./globals.css";

export const metadata = {
  title: "WHACK26 - Silent Grace",
  description: "Hackathon prototype for banking and payment grace period",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 min-h-screen text-slate-900 antialiased p-6 md:p-12">
        <main className="max-w-2xl mx-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
