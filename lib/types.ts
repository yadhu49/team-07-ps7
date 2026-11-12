export type DeliveryStatus =
  | "pending"
  | "assigned"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "returned";

export type TimeWindow = "morning" | "afternoon" | "evening";

export type BoardDelivery = {
  id: number;
  order_ref: string;
  customer_name: string;
  address: string;
  zone_id: string;
  zone_name: string;
  parcel_size: "small" | "medium" | "large";
  is_cod: boolean;
  cod_amount: number;
  delivery_date: string;
  time_window: TimeWindow;
  rider_id: string | null;
  rider_name: string | null;
  status: DeliveryStatus;
  attempts: number;
};

export type BoardRider = {
  id: string;
  name: string;
  zone_id: string;
  zone_name: string;
  vehicle: "bike" | "scooter" | "van";
  capacity: number;
  active: number;
  free: number;
  is_active: boolean;
  shift: { start: string; end: string } | null;
  delivered_today: number;
};

export type BoardResponse = {
  today: string;
  counts: Record<DeliveryStatus, number>;
  deliveries: BoardDelivery[];
  riders: BoardRider[];
};

export type RiderSummary = {
  id: string;
  name: string;
  zone_id: string;
  zone_name: string;
  vehicle: string;
  shift: { start: string; end: string } | null;
  /** Deliveries this rider can still mark today. */
  active: BoardDelivery[];
  /** Cash collected on today's delivered COD parcels. */
  cod_collected: number;
  delivered_count: number;
  /** Cash still to collect on the active parcels. */
  cod_pending: number;
};

export type RiderViewResponse = {
  today: string;
  riders: RiderSummary[];
};
