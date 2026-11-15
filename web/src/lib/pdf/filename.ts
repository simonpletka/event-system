import type { PdfLang } from "@/lib/pdf/i18n";

/** "Zimní gala / VIP" → "Zimni-gala-VIP": file-name safe, no diacritics, words joined by "-". */
function fileSafe(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A quote PDF's file name: "<number>.<project>_quote.pdf" in English,
 * "<number>.<project>_nabidka.pdf" in Czech, e.g. "26-012.Charity-Gala_quote.pdf".
 * Used for the download, the Drive export and the email attachment alike.
 */
export function quotePdfFilename(number: string, projectTitle: string, lang: PdfLang): string {
  const project = fileSafe(projectTitle);
  const kind = lang === "cs" ? "nabidka" : "quote";
  return project ? `${number}.${project}_${kind}.pdf` : `${number}_${kind}.pdf`;
}
