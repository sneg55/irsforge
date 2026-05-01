/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: process.env.NODE_ENV === 'development' ? undefined : false,
}

export default nextConfig
