export interface Stop {
  gid: string;
  name: string;
  lat: number;
  lon: number;
}

export interface StopsResponse {
  stops: Stop[];
  fetched_at: number;
}

export interface Departure {
  line: string;
  mode: string;
  destination: string | null;
  planned_time: string;
  estimated_time: string | null;
  is_cancelled: boolean;
  is_part_cancelled: boolean;
  platform: string | null;
  bg_color: string | null;
  fg_color: string | null;
}

export interface DeparturesResponse {
  stop_name: string | null;
  departures: Departure[];
  fetched_at: number;
}
