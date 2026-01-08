/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // 优化配置
  compress: true,
  poweredByHeader: false,
  // monorepo 配置：指向工作区根目录，让 standalone 正确追踪依赖
  outputFileTracingRoot: path.join(__dirname, '../../'),
}

module.exports = nextConfig
