import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  EB_Garamond,
  Cinzel,
  Playfair_Display,
  Lora,
  Inter,
  Fraunces,
  Montserrat,
  Jost,
} from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-eb-garamond",
  display: "swap",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-cinzel",
  display: "swap",
});

// Optional fonts for the per-site typography systems. preload:false so the
// browser only fetches a family when a site actually uses it.
const playfair = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-playfair", display: "swap", preload: false });
const lora = Lora({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-lora", display: "swap", preload: false });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", preload: false });
const fraunces = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-fraunces", display: "swap", preload: false });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap", preload: false });
const jost = Jost({ subsets: ["latin"], variable: "--font-jost", display: "swap", preload: false });

export const metadata: Metadata = {
  title: "Hosting Thingy — Sacred hosting for your work",
  description:
    "Host your website, connect your domain, and run your business from one calm place.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${ebGaramond.variable} ${cinzel.variable} ${playfair.variable} ${lora.variable} ${inter.variable} ${fraunces.variable} ${montserrat.variable} ${jost.variable}`}
    >
      <body className="bg-background text-parchment font-body min-h-screen">
        {children}
      </body>
    </html>
  );
}
