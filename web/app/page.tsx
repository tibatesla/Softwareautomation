import { redirect } from "next/navigation";

// proxy.ts redirects unauthenticated visitors to /login before this ever
// renders, so any request that reaches here already has a session.
export default function Home() {
  redirect("/dashboard");
}
