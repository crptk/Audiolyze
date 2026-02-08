import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audiolyze - Your music, on stage.",
  description: "AI-powered collaborative music visualizer. Import music, create stages, and vibe with others in real time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
