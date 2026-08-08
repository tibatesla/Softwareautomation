import "server-only";

const backendUrl = process.env.BACKEND_URL;

if (!backendUrl) {
  throw new Error("Missing critical BACKEND_URL environment configuration.");
}

export const BACKEND_URL = backendUrl;
