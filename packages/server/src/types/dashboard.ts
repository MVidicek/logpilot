export type WidgetType = 'log_volume' | 'error_rate' | 'top_sources' | 'recent_alerts' | 'log_count';

export interface Widget {
  id: string;
  dashboard_id: string;
  type: WidgetType;
  title: string;
  config: WidgetConfig;
  position: { x: number; y: number; w: number; h: number };
}

export interface WidgetConfig {
  time_range_minutes?: number;
  interval_minutes?: number;
  source?: string;
  level?: string;
  limit?: number;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: Widget[];
  created_at: Date;
  updated_at: Date;
}

export interface CreateDashboardInput {
  name: string;
  description?: string;
}

export interface CreateWidgetInput {
  type: WidgetType;
  title: string;
  config: WidgetConfig;
  position: { x: number; y: number; w: number; h: number };
}
