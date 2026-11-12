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

/* ------------------------------- supervisor ------------------------------- */

export type DashboardTotals = {
  date: string;
  /** Deliveries scheduled for today. */
  deliveries: number;
  delivered: number;
  failed: number;
  open: number;
  pending: number;
  /** Cash from today's delivered COD parcels. */
  codCollected: number;
  /** Cash still to collect on today's open COD parcels. */
  codPending: number;
  /** Delivered / (delivered + failed), in percent. */
  successRate: number;
  activeRiders: number;
  capacityInUse: number;
  capacityTotal: number;
};

export type DashboardZone = {
  zone_id: string;
  zone_name: string;
  total: number;
  delivered: number;
  failed: number;
  open: number;
  cod_open: number;
};

export type DashboardRider = {
  id: string;
  name: string;
  zone_name: string;
  delivered: number;
  failed: number;
  active: number;
  capacity: number;
  cod_collected: number;
};

export type DashboardTrendPoint = {
  date: string;
  delivered: number;
  failed: number;
  total: number;
};

export type DashboardReason = { reason: string; count: number };

export type DashboardResponse = {
  today: string;
  totals: DashboardTotals;
  zones: DashboardZone[];
  riders: DashboardRider[];
  trend: DashboardTrendPoint[];
  reasons: DashboardReason[];
};

export type BatchAssignResult = {
  date: string;
  zone: string;
  time_window: string | null;
  dry_run: boolean;
  assigned: { order_ref: string; rider_id: string; rider_name: string }[];
  unassigned: { order_ref: string; reason: string }[];
  summary: string;
};
