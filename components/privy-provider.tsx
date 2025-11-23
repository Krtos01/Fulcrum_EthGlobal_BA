"use client";

import { PrivyProvider } from "@privy-io/react-auth";

export default function PrivyProviderWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <PrivyProvider
            appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
            config={{
                loginMethods: ["email", "wallet"],
                appearance: {
                    theme: "dark",
                    accentColor: "#676FFF",
                },
                supportedChains: [
                    {
                        id: 5042002,
                        name: "Arc Testnet",
                        network: "arc-testnet",
                        nativeCurrency: {
                            name: "USDC",
                            symbol: "USDC",
                            decimals: 18,
                        },
                        rpcUrls: {
                            default: {
                                http: ["https://rpc.testnet.arc.network"],
                            },
                            public: {
                                http: ["https://rpc.testnet.arc.network"],
                            },
                        },
                        blockExplorers: {
                            default: {
                                name: "ArcScan",
                                url: "https://testnet.arcscan.app",
                            },
                        },
                    },
                ],
            }}
        >
            {children}
        </PrivyProvider>
    );
}
