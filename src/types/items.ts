export type Side = "available" | "selected";

export type ItemsResponse = {
  items: string[];
  total: number;
  offset: number;
  limit: number;
  side: Side;
  query: string;
  selectedCount: number;
};

export type FetchParams = {
  side: Side;
  query: string;
  offset: number;
  limit: number;
};
