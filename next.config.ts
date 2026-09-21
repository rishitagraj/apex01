import path from "node:path";
import type { NextConfig } from "next";

const projectRoot = path.resolve(process.cwd());

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pg",
    "@prisma/adapter-pg",
    "pdf-parse",
    "pdfjs-dist",
  ],
  async redirects() {
    return [{ source: "/tasks", destination: "/todos", permanent: true }];
  },
  // Next.js can mistake the home directory for the project root when a
  // package-lock.json exists there. Pin it explicitly.
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;