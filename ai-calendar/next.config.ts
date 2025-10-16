import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Don't fail the build on ESLint warnings during production builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Don't fail the build on TypeScript errors during production builds  
    ignoreBuildErrors: true,
  },
  // Use standalone output to avoid some prerendering issues
  output: 'standalone',
  // Disable static optimization to prevent prerendering issues
  trailingSlash: false,
  // Experimental features for React 19 compatibility
  experimental: {
    // Enable React 19 features
    reactCompiler: false,
  },
  // Webpack configuration to handle problematic dependencies
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Add fallbacks for Node.js modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    
    // External problematic packages to prevent warnings
    config.externals = config.externals || [];
    config.externals.push({
      '@react-native-async-storage/async-storage': 'commonjs @react-native-async-storage/async-storage',
      'pino-pretty': 'commonjs pino-pretty',
    });
    
    return config;
  },
};

export default nextConfig;
