import { requireUser, projectWhereForUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { searchAddresses, searchPlaces } from "@/lib/address-search";
import { matchSavedVenues, mergePlaceSuggestions } from "@/lib/saved-venues";

export async function GET(req: Request) {
  const user = await requireUser();

  const params = new URL(req.url).searchParams;
  const q = params.get("q") ?? "";
  if (params.get("kind") !== "place") {
    return Response.json({ suggestions: await searchAddresses(q) });
  }

  // kind=place: venues already used on projects the user can see come first
  // (including ones typed by hand, which the map doesn't know), then named
  // places from the map search.
  const [venues, places] = await Promise.all([
    q.trim().length >= 2
      ? prisma.venue.findMany({ where: { project: projectWhereForUser(user) }, select: { name: true, address: true } })
      : Promise.resolve([]),
    searchPlaces(q),
  ]);
  return Response.json({ suggestions: mergePlaceSuggestions(matchSavedVenues(venues, q), places) });
}
