/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // NEXT_DIST_DIR lets a verification build write somewhere other than .next,
  // so it never clobbers the files a running `npm run dev` is serving.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    // Server Actions reject bodies over 1 MB by default, but product photos
    // are validated up to 5 MB (lib/actions/products.ts) -- allow that plus
    // the rest of the form.
    serverActions: { bodySizeLimit: '6mb' },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
