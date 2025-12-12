/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 本地开发不使用 standalone
  // output: 'standalone',
  // 优化配置
  compress: true,
  poweredByHeader: false,
}

module.exports = nextConfig
