export interface Appli {
  name: string;
  description: string;
  context: string;
  year: number;
  month?: number;
  activity?: string;
  hours: number;
  images: number;
  technos: Array<Techno>;
}

export interface Techno {
  name: string;
  level: Level;
}

export enum Level {
  NOOB = 1,
  AMATEUR = 2,
  INTERMEDIATE = 3,
  ADVANCED = 4,
  EXPERT = 5,
}

export const MAX_LEVEL = Level.EXPERT;

const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** "mai 2013", or just "2013" when the month is unknown. */
export function appliDateLabel(appli: Appli): string {
  const month = appli.month ? MONTHS_FR[appli.month - 1] : undefined;
  return month ? `${month} ${appli.year}` : `${appli.year}`;
}

/** Images live in assets/images/apps as "<name> <n>.jpg", n starting at 1. */
export function appliImageUrls(appli: Appli): Array<string> {
  return Array.from(
    { length: appli.images },
    (_, i) => `/assets/images/apps/${encodeURIComponent(`${appli.name} ${i + 1}.jpg`)}`,
  );
}
