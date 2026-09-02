import { getLocale, getDictionary } from "@/lib/i18n";

export default async function FilesTab() {
  const t = getDictionary(await getLocale());
  return (
    <div className="max-w-2xl">
      <p className="text-sm placeholder-text">{t.projects.filesTab.notBuilt}</p>
    </div>
  );
}
