import type { Metadata, Viewport } from "next";
import Script from "next/script";
import ApiKeepAlive from "@/components/ApiKeepAlive";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://bhukkadbox.in"),
  title: "Bhukkad Box",
  description: "Fresh Meals, Freshly Ordered - Campus Canteen Hub",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-icon.png", sizes: "512x512", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Bhukkad Box",
    description: "Fresh Meals, Freshly Ordered - Campus Canteen Hub",
    url: "https://bhukkadbox.in",
    siteName: "Bhukkad Box",
    images: [
      {
        url: "https://bhukkadbox.in/logo.png",
        width: 512,
        height: 512,
        alt: "Bhukkad Box Logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Bhukkad Box",
    description: "Fresh Meals, Freshly Ordered - Campus Canteen Hub",
    images: ["https://bhukkadbox.in/logo.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bhukkad Box",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#e85d20",
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Bhukkad Box",
  "alternateName": "BhukkadBox",
  "url": "https://bhukkadbox.in",
  "logo": "https://bhukkadbox.in/logo.png",
  "image": "https://bhukkadbox.in/logo.png",
  "description": "Fresh Meals, Freshly Ordered - Campus Canteen Hub",
  "contactPoint": [
    {
      "@type": "ContactPoint",
      "telephone": "+91 8640006268",
      "contactType": "customer service",
      "areaServed": "IN"
    },
    {
      "@type": "ContactPoint",
      "telephone": "+91 6266953342",
      "contactType": "customer service",
      "areaServed": "IN"
    }
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className="font-sans antialiased min-h-screen bg-bg-main text-text-main flex flex-col">
        <ApiKeepAlive />
        {children}
      </body>
    </html>
  );
}
