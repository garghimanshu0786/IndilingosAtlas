import { execSync } from "node:child_process";
import type { NextConfig } from "next";

function questDevOrigins(): string[] {
  const origins = ["10.*.*.*", "192.168.*.*", "172.16.*.*", "172.17.*.*", "172.18.*.*", "172.19.*.*"];
  try {
    const ip = execSync("ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null", {
      encoding: "utf8",
    }).trim();
    if (ip) origins.push(ip);
  } catch {
    /* empty */
  }
  return origins;
}

const nextConfig: NextConfig = {
  reactStrictMode: false,
  output: "standalone",
  allowedDevOrigins: questDevOrigins(),
};

export default nextConfig;
