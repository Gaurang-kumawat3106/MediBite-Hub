import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bhukkad Box",
  description: "Fresh Meals, Freshly Ordered",
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
      </head>
      <body className="font-sans antialiased min-h-screen bg-bg-main text-text-main flex flex-col">
        {children}
      </body>
    </html>
  );
}
