import { BrowserProvider } from 'ethers';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export class WalletService {
  private static provider: BrowserProvider | null = null;

  /**
   * Check if MetaMask is installed
   */
  static isMetaMaskInstalled(): boolean {
    return typeof window !== 'undefined' && !!window.ethereum;
  }

  /**
   * Connect to MetaMask
   */
  static async connect(): Promise<string> {
    if (!this.isMetaMaskInstalled()) {
      throw new Error('Please install MetaMask');
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      // Initialize provider
      this.provider = new BrowserProvider(window.ethereum);

      // Switch to Flow EVM Testnet if not already
      await this.switchToFlowEVM();

      return accounts[0];
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
      throw error;
    }
  }

  /**
   * Switch to Flow EVM Testnet
   */
  static async switchToFlowEVM(): Promise<void> {
    const chainId = '0x221'; // 545 in hex
    const chainName = 'Flow EVM Testnet';
    const rpcUrl = 'https://testnet.evm.nodes.onflow.org';
    const blockExplorer = 'https://evm-testnet.flowscan.io';

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId,
                chainName,
                nativeCurrency: {
                  name: 'FLOW',
                  symbol: 'FLOW',
                  decimals: 18,
                },
                rpcUrls: [rpcUrl],
                blockExplorerUrls: [blockExplorer],
              },
            ],
          });
        } catch (addError) {
          console.error('Error adding Flow EVM network:', addError);
          throw addError;
        }
      } else {
        throw switchError;
      }
    }
  }

  /**
   * Get connected account
   */
  static async getAccount(): Promise<string | null> {
    if (!this.isMetaMaskInstalled()) {
      return null;
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_accounts',
      });
      return accounts[0] || null;
    } catch (error) {
      console.error('Error getting account:', error);
      return null;
    }
  }

  /**
   * Get provider
   */
  static getProvider(): BrowserProvider {
    if (!this.provider) {
      this.provider = new BrowserProvider(window.ethereum);
    }
    return this.provider;
  }

  /**
   * Disconnect wallet (clear local state)
   */
  static disconnect(): void {
    this.provider = null;
  }

  /**
   * Set up event listeners
   */
  static setupEventListeners(
    onAccountsChanged: (accounts: string[]) => void,
    onChainChanged: (chainId: string) => void
  ): () => void {
    if (!this.isMetaMaskInstalled()) {
      return () => {};
    }

    const handleAccountsChanged = (accounts: string[]) => {
      onAccountsChanged(accounts);
    };

    const handleChainChanged = (chainId: string) => {
      onChainChanged(chainId);
      // Reload to ensure consistency
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    // Return cleanup function
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }
}