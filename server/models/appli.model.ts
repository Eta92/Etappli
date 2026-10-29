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
