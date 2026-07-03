export interface HelpCatalogArticle {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  body: string;
}

export interface HelpCatalogCategory {
  slug: string;
  title: string;
  description: string;
  icon: string;
  position: number;
  articles: HelpCatalogArticle[];
}
