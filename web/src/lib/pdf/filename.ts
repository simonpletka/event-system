import type { PdfLang } from "@/lib/pdf/i18n";

/** "Zimní gala / VIP" → "Zimni_gala_VIP": file-name safe, no diacritics, spaces (and other punctuation) as "_", hyphens kept. */
function fileSafe(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9-]+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "");
}

/**
 * A quote PDF's file name: "<number>.<project>-quote.pdf" in English,
 * "<number>.<project>-nabidka.pdf" in Czech, e.g. "26-012.Charity_Gala-quote.pdf".
 * Used for the download, the Drive export and the email attachment alike.
 */
export function quotePdfFilename(number: string, projectTitle: string, lang: PdfLang): string {
  const project = fileSafe(projectTitle);
  const kind = lang === "cs" ? "nabidka" : "quote";
  return project ? `${number}.${project}-${kind}.pdf` : `${number}-${kind}.pdf`;
}
