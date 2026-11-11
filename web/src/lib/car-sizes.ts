/**
 * Size of each carsharing car type, for ordering the car-type dropdown from
 * smallest to biggest. Mirrors the "Carsharing car sizes" sheet: a size group
 * (city car up to van), then trunk litres with the seats up. Keys are the
 * tariffs' `carClass` names.
 */
const GROUP = { city: 0, small: 1, smallSuv: 2, midsize: 3, large: 4, van: 5 } as const;

const CAR_SIZES: Record<string, [group: number, trunkLitres: number]> = {
  "Fiat Panda": [GROUP.city, 225],
  "Toyota Aygo X": [GROUP.city, 231],
  "Toyota Aygo X Economy": [GROUP.city, 231],
  "Toyota Yaris": [GROUP.small, 286],
  "Toyota Yaris New": [GROUP.small, 286],
  "Škoda Fabia": [GROUP.small, 380],
  "Toyota C-HR": [GROUP.smallSuv, 388],
  "Toyota C-HR Impress": [GROUP.smallSuv, 388],
  "Toyota Yaris Cross": [GROUP.smallSuv, 397],
  "Toyota Yaris Cross Impress": [GROUP.smallSuv, 397],
  "Škoda Kamiq": [GROUP.smallSuv, 400],
  "Škoda Formentor": [GROUP.smallSuv, 450],
  "Škoda Scala": [GROUP.smallSuv, 467],
  "Škoda Elroq": [GROUP.smallSuv, 470],
  "Toyota Corolla Impress": [GROUP.midsize, 361],
  "Škoda Karoq": [GROUP.midsize, 521],
  "Škoda Octavia": [GROUP.midsize, 600],
  "Škoda Superb": [GROUP.large, 645],
  "Škoda Kodiaq": [GROUP.large, 910],
  "Mercedes Vito": [GROUP.van, 800],
};

/** Smallest to biggest. A car type that isn't listed keeps its place after all the listed ones. */
export function bySize(carClasses: string[]) {
  const size = (carClass: string) => CAR_SIZES[carClass] ?? [Infinity, Infinity];
  return [...carClasses].sort((a, b) => size(a)[0] - size(b)[0] || size(a)[1] - size(b)[1]);
}
