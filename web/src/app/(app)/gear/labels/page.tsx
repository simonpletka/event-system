import Link from "next/link";
import QRCode from "qrcode";
import { requireUser } from "@/lib/authz";
import { getLocale, getDictionary } from "@/lib/i18n";
import { getGearLabelUnits } from "@/lib/queries/gear-ops";
import { getGearTypeOptions } from "@/lib/queries/gear";
import { prisma } from "@/lib/prisma";
import { formatGearCode } from "@/lib/gear-code";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrintButton } from "@/components/gear/PrintButton";

/**
 * A4 sheet of unit labels: QR of the unit's /g/<code> URL (absolute, from
 * APP_BASE_URL, so a phone camera opens it), name, #n and the code in text.
 * 3 × 8 labels of 63.5 × 33.9 mm. The only label work: no designer, no printer integration.
 */
export default async function GearLabelsPage({ searchParams }: { searchParams: Promise<{ type?: string; u?: string | string[] }> }) {
  await requireUser();
  const locale = await getLocale();
  const t = getDictionary(locale).gear;
  const q = await searchParams;
  const unitIds = (Array.isArray(q.u) ? q.u : q.u ? [q.u] : []).slice(0, 300);
  const typeId = q.type ?? "";
  const [types, typeUnits, labels] = await Promise.all([
    getGearTypeOptions(),
    typeId
      ? prisma.gearUnit.findMany({ where: { typeId, condition: { not: "RETIRED" } }, orderBy: { number: "asc" }, select: { id: true, number: true } })
      : Promise.resolve([]),
    getGearLabelUnits(unitIds.length ? { unitIds } : { typeId }),
  ]);
  const base = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const withQr = await Promise.all(
    labels.map(async (l) => ({ ...l, qr: await QRCode.toDataURL(`${base}/g/${l.code}`, { margin: 0, errorCorrectionLevel: "M", width: 240 }) }))
  );

  return (
    <div className="gear-scope">
      <style>{`
        @page { size: A4; margin: 10mm 7mm; }
        @media print {
          body { background: #fff !important; }
          .labels-sheet { display: grid; grid-template-columns: repeat(3, 63.5mm); grid-auto-rows: 33.9mm; gap: 0 2.5mm; }
          .label-card { border: 0.2mm dashed #bbb !important; background: #fff !important; color: #000 !important; break-inside: avoid; }
          .label-card * { color: #000 !important; }
        }
      `}</style>
      <div className="print-hide">
        <PageHeader>
          <div className="max-w-[1180px] flex flex-wrap items-end justify-between gap-3">
            <div>
              <Link href="/gear" className="inline-block text-[12px] placeholder-text hover:text-accent">
                ← {t.backToGear}
              </Link>
              <h1 className="text-[34px] md:text-[40px] font-bold tracking-tight mt-1">{t.labelsTitle}</h1>
            </div>
            {withQr.length > 0 && <PrintButton label={t.labelsPrint} />}
          </div>
        </PageHeader>
        <div className="max-w-[1180px] mt-6 flex flex-col gap-4">
          <p className="text-[13.5px] placeholder-text max-w-prose">{t.labelsIntro}</p>
          <form method="get" className="card p-5 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 max-w-[420px]">
              <span className="field-label">{t.labelsPickType}</span>
              <select name="type" defaultValue={typeId} className="input">
                <option value="">{t.chooseType}</option>
                {types.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.category} · {x.name}
                  </option>
                ))}
              </select>
            </label>
            {typeUnits.length > 0 && (
              <fieldset className="flex flex-wrap gap-2">
                <legend className="field-label mb-1.5">{t.colUnits}</legend>
                {typeUnits.map((u) => (
                  <label key={u.id} className="inline-flex items-center gap-2 px-3 min-h-[40px] rounded-xl border border-ink/16 text-[13px]">
                    <input type="checkbox" name="u" value={u.id} defaultChecked={unitIds.length === 0 || unitIds.includes(u.id)} />#{u.number}
                  </label>
                ))}
              </fieldset>
            )}
            <button type="submit" className="btn self-start">
              {t.labelsShow}
            </button>
          </form>
          {withQr.length === 0 && <p className="text-[13px] placeholder-text">{t.labelsNone}</p>}
          {withQr.length > 0 && <p className="text-[12.5px] placeholder-text">{t.labelsSelectedUnits(withQr.length)}</p>}
        </div>
      </div>

      {withQr.length > 0 && (
        <div className="labels-sheet mt-4 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 max-w-[1180px]">
          {withQr.map((l) => (
            <div key={l.id} className="label-card card !rounded-xl p-[2.5mm] flex items-center gap-[3mm] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
              <img src={l.qr} alt="" className="w-[26mm] h-[26mm] shrink-0 bg-white p-[1mm] rounded" />
              <div className="min-w-0 flex flex-col gap-[1mm]">
                <span className="text-[11pt] font-bold leading-tight line-clamp-2">{l.typeName}</span>
                <span className="text-[14pt] font-bold leading-none">#{l.number}</span>
                <span className="text-[9pt] tracking-[0.08em] tabular-nums">{formatGearCode(l.code)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
