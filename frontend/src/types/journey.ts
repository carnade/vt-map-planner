export interface LocationHit {
  gid: string;
  name: string;
  lat: number;
  lon: number;
}

export interface JourneyStop {
  name: string;
  platform: string | null;
  planned_time: string;
  estimated_time: string | null;
  lat: number | null;
  lon: number | null;
}

export interface JourneyLeg {
  line: string;
  mode: string;
  direction: string | null;
  origin: JourneyStop;
  destination: JourneyStop;
  is_cancelled: boolean;
  is_part_cancelled: boolean;
  bg_color: string | null;
  fg_color: string | null;
}

export interface Journey {
  details_reference: string;
  legs: JourneyLeg[];
  is_departed: boolean;
}

export interface RouteLeg {
  line: string;
  mode: string;
  bg_color: string | null;
  fg_color: string | null;
  coords: [number, number][];
}

export interface RouteResponse {
  legs: RouteLeg[];
  line_designations: string[];
}
