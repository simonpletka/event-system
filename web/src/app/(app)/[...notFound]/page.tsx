import { notFound } from "next/navigation";

// Anything under the app shell that matches no real route lands here and
// falls through to (app)/not-found.tsx — so a mistyped URL keeps the sidebar
// and a way back, instead of dropping to the bare root 404.
export default function AppCatchAll() {
  notFound();
}
