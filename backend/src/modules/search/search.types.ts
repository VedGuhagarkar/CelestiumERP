export type SearchCategory =
  | 'ALL'
  | 'JOBS'
  | 'CUSTOMERS'
  | 'EMPLOYEES'
  | 'MATERIALS'
  | 'HEAT_LOTS'
  | 'MACHINES'
  | 'INSPECTIONS'
  | 'NCRS'
  | 'WAREHOUSES'
  | 'DISPATCHES'
  | 'INVOICES';

export interface ISearchResultItem {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string;
  referenceCode: string;
  status?: string;
  actionUrl: string;
  metadata?: Record<string, any>;
}

export interface ISearchGroup {
  category: SearchCategory;
  label: string;
  totalMatches: number;
  items: ISearchResultItem[];
}

export interface IQuickAction {
  id: string;
  title: string;
  description: string;
  shortcut?: string;
  category: string;
  requiredPermission?: string;
  actionUrl: string;
  icon: string;
}

export interface ISearchResponse {
  query: string;
  category: SearchCategory;
  totalResults: number;
  groups: ISearchGroup[];
  suggestions: string[];
  quickActions: IQuickAction[];
}

export interface QuerySearchDto {
  q: string;
  category?: SearchCategory;
  limit?: number;
}
