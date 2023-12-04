/** @type {import('next').NextConfig} **/
const nextConfig = {
    images: {
      // remotePatterns: [
      //   {
      //     protocol: 'http',
      //     hostname: 'localhost',
      //     port: "80",
      //     pathname: '**',
      //   },
      // ],
      domains: ['localhost']
    },
  }

module.exports = nextConfig
