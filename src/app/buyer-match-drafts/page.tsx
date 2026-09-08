"use client";
import Link from "next/link";
import { useQueryParam } from "@/lib/client";
import { PageHeader } from "@/components/ui/primitives";
import { MatchComposer } from "@/components/app/match-composer";
export default function BuyerMatchDraftsPage() {
  const buyerId = useQueryParam("buyerId"), candidateId = useQueryParam("candidateId"), kind = useQueryParam("kind"), draft = useQueryParam("draft");
  return <div className="fade-in"><PageHeader title="Buyer match · message studio" sub="Personalized drafts, grounded in your saved records"><Link className="btn" href="/buyers?tab=matches">← Buyer Match</Link></PageHeader>
    {buyerId && candidateId && (kind === "listing" || kind === "opportunity") ? <MatchComposer key={buyerId + candidateId + kind} pair={{ buyerId, candidateId, kind }} initialId={draft} /> : <p className="text-sm">Choose Match beside a property on Buyer Match to start.</p>}
  </div>;
}
