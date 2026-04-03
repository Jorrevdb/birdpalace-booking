/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tell Next.js not to bundle these Node.js-only packages with webpack
  serverExternalPackages: ['googleapis', 'nodemailer'],
}

module.exports = nextConfig
