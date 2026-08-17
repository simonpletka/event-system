export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">{title}</h1>
      <p className="text-sm placeholder-text max-w-prose">{description}</p>
    </div>
  );
}
