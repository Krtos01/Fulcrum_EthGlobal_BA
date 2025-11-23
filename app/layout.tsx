import type { Metadata } from "next";
import { Work_Sans } from "next/font/google";
import "./globals.css";
import PrivyProviderWrapper from "@/components/privy-provider";

const workSans = Work_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Protocol 402",
  description: "Autonomous leverage agent on Arc Network",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={workSans.className}>
        <PrivyProviderWrapper>{children}</PrivyProviderWrapper>
      </body>
    </html>
  );
}
