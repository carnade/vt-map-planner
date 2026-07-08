export interface Vehicle {
  id: string;
  line: string;
  mode: string;
  lat: number;
  lon: number;
  destination: string | null;
  bg_color: string | null;
  fg_color: string | null;
}

export interface PositionsResponse {
  vehicles: Vehicle[];
  fetched_at: number;
}
