import { Suspense } from "react";
import { OpportunityBoard } from "@/components/app/opportunity-board";
import { Loading } from "@/components/ui/primitives";

export default function OffMarketPage() {
  return <Suspense fallback={<Loading />}><OpportunityBoard offMarketOnly /></Suspense>;
}
