export type Lang = "de" | "en" | "ar";

export interface Translation {
  id: string;
  key: string;
  de: string;
  en: string;
  ar: string;
  updated_at: string;
}

export interface Project {
  id: string;
  title: string;
  subtitle_de: string;
  subtitle_en: string;
  subtitle_ar: string;
  badges: string[];
  status: "active" | "completed" | "in-progress";
  tech_stack: string[];
  image_url: string;
  github_url: string | null;
  demo_url: string | null;
  subpage_url: string | null;
  is_hero: boolean;
  sort_order: number;
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
