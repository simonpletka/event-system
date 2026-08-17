import { requireUser } from "@/lib/authz";
import { ComingSoon } from "@/components/ComingSoon";

export default async function FinancePage() {
  await requireUser();
  return (
    <ComingSoon
      title="Finance"
      description="Quotes, invoices, expenses and reports land in the next phase. Individual events already track their own quotes, invoices and expenses on the event detail page."
    />
  );
}
