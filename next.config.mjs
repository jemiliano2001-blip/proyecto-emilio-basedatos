/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Permite que los Server Actions (p. ej. el login) funcionen cuando la app
      // se accede a través de un túnel de desarrollo (port forwarding de VS Code/Cursor).
      allowedOrigins: ['localhost:3000', '*.devtunnels.ms'],
    },
  },
}

export default nextConfig
