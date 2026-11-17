import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseUrl?.protocol === 'https:' ? [{
      protocol: 'https', hostname: supabaseUrl.hostname, port: supabaseUrl.port,
      pathname: '/storage/v1/object/public/avatars/**',
    }] : [],
  },
  async headers() {
    return [{ source: '/sw.js', headers: [
      { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
      { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      { key: 'Service-Worker-Allowed', value: '/' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'; object-src 'none'" },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
    ] }];
  },
};

export default nextConfig;
