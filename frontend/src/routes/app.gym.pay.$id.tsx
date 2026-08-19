import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/clearbill-store";
import { formatDate } from "@/components/clearbill/shared";
import { PayShell, BillCard, BillerBox, SecurityFooter } from "@/components/clearbill/pay";

export const Route = createFileRoute("/app/gym/pay/$id")({
  head: () => ({
    meta: [
      { title: "Pay Membership · ClearBill" },
      { name: "description", content: "Secure payment portal for your gym membership." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GymPayPortal,
});

function GymPayPortal() {
  const { id } = Route.useParams();
  const members = useStore((s) => s.gymMembers);
  const member = members.find((m) => m.id === id);

  const name = member?.name ?? "Ahmed Raza";
  const pkg = member?.packageName ?? "3 Months";
  const fee = member?.fee ?? 15000;
  const expiry = member?.expiry ?? new Date(Date.now() + 90 * 86400000).toISOString();

  return (
    <PayShell brand="Johar Town Iron Gym" tag="Membership Fee">
      <BillCard
        rows={[
          ["Billed to", name],
          ["Package", pkg],
          ["Expiry", formatDate(expiry)],
        ]}
        due={fee}
        period={`Membership · ${pkg}`}
      />
      <BillerBox consumerId="999999-03214261066" />
      <Button className="mt-5 h-12 w-full rounded-md text-base font-semibold">
        <CreditCard className="mr-2 h-4 w-4" />
        Pay via Safepay (Debit/Credit Card)
      </Button>
      <SecurityFooter />
    </PayShell>
  );
}
