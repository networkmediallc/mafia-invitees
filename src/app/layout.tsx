import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mafia Club Invite Desk",
  description: "Secret Mafia Club guest ranking and invite desk",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
