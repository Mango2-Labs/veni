import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Unbounded } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// Unbounded for headlines, places and stamps; Plus Jakarta Sans for everything else.
const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Veni",
  description:
    "Host events people show up to. Guests stake a few dollars to sign up and get it back when they check in.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${unbounded.variable} ${jakarta.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
