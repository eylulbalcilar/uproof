import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";

/// Read-only config. Users never connect a wallet: the backend relayer signs
/// every write, so the frontend only needs a public client to read state.
export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(),
  },
});
