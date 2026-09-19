import { LandingPage } from "@/components/landing/landing-page";
import { verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const userId = await verifySession();
  return <LandingPage signedIn={Boolean(userId)} />;
}