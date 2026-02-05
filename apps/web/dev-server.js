#!/usr/bin/env node
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

// 开发服务器配置
const config = {
  port: 3100,
  hostname: '0.0.0.0',
  https: {
    key: './localhost+6-key.pem',
    cert: './localhost+6.pem',
  },
}

// 检查证书文件是否存在
const keyPath = path.join(__dirname, config.https.key)
const certPath = path.join(__dirname, config.https.cert)
const hasHttpsCerts = fs.existsSync(keyPath) && fs.existsSync(certPath)

// 构建命令参数
const args = [
  'dev',
  '-p', config.port.toString(),
  '--hostname', config.hostname,
]

if (hasHttpsCerts) {
  args.push('--experimental-https')
  args.push('--experimental-https-key', config.https.key)
  args.push('--experimental-https-cert', config.https.cert)
  console.log('[dev-server] Starting with HTTPS (certificates found)')
} else {
  console.log('[dev-server] Starting with HTTP (no certificates found)')
  console.log('[dev-server] To enable HTTPS, generate certificates using:')
  console.log('[dev-server]   cd apps/web && mkcert localhost 127.0.0.1 192.168.0.101 ::1')
}

// 启动 Next.js
const child = spawn('next', args, {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname,
})

child.on('exit', (code) => {
  process.exit(code || 0)
})
