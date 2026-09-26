export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export interface WebSearchProvider {
  search(query: string): Promise<SearchResult[]>;
}
