export type Lang = "de" | "en" | "ar";

export interface Translation {
  id: string;
  key: string;
  de: string;
  en: string;
  ar: string;
  updated_at: string;
}

export type ProjectStatus = "active" | "in-progress" | "completed";

export interface ProjectFeature {
  de: string;
  en: string;
  ar: string;
}

export interface Project {
  id: string;            // UUID (stabil)
  slug: string;          // "studynexus" (änderbar)
  title: string;
  description_de: string;
  description_en: string;
  description_ar: string;
  badges: string[];
  features: ProjectFeature[];
  status: ProjectStatus;
  image_url: string;
  github_url: string | null;
  demo_url: string | null;
  subpage_url: string | null;
  timeframe: string | null;
  role: string | null;
  is_hero: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface GithubCard {
  title_de: string; title_en: string; title_ar: string;
  text_de: string;  text_en: string;  text_ar: string;
  btn_de: string;   btn_en: string;   btn_ar: string;
  url: string;
}

export interface ChangelogEntry {
  id: string;
  version: string;
  date: string;
  category: "feature" | "fix" | "refactor" | "security";
  title_de: string;
  title_en: string;
  title_ar: string;
  description_de: string;
  description_en: string;
  description_ar: string;
  created_at: string;
}

export interface ThoughtPost {
  id: string;
  title: string;
  content: string;
  lang: Lang;
  tags: string[];
  image_url: string | null;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoadmapEntry {
  id: string;
  title_de: string;
  title_en: string;
  title_ar: string;
  status: "planned" | "in-progress" | "completed";
  sort_order: number;
}

export interface Setting {
  key: string;
  value: unknown;
  updated_at: string;
}
