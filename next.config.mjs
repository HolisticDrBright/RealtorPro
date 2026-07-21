/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // better-sqlite3 is a native module used only in server code (API routes,
  // server actions, scripts). Keep it external so Next does not try to bundle it.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
