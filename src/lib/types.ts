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
  published: boolean;
  created_at: string;
}

export interface ThoughtPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  tags: string[];
  lang: Lang;
  status: "draft" | "published";
  reading_minutes: number | null;
  translation_group_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type RoadmapScope = "portfolio" | "project";
export type RoadmapStatus = "planned" | "in-progress" | "completed";

export interface RoadmapEntry {
  id: string;
  scope: RoadmapScope;
  project_slug: string | null;
  title_de: string;
  title_en: string;
  title_ar: string;
  description_de: string;
  description_en: string;
  description_ar: string;
  phase_label_de: string;
  phase_label_en: string;
  phase_label_ar: string;
  status: RoadmapStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  key: string;
  value: unknown;
  updated_at: string;
}

// ── Media ─────────────────────────────────────────────────────────────────────

export type MediaAssetType = 'image' | 'vector' | 'video' | 'document' | 'other'

export interface MediaManifestEntry {
  path: string
  category: string
  type: MediaAssetType
  size_bytes: number
  has_webp?: boolean
  used_in: string[]
  is_orphan: boolean
}

export interface MediaManifest {
  generated_at: string
  summary: {
    count: number
    total_bytes: number
    total_mb: number
    orphans: number
    categories: string[]
    skipped_webp: number
  }
  assets: MediaManifestEntry[]
}

export interface StorageFile {
  name: string
  size_bytes: number
  mime_type: string
  updated_at: string
  public_url: string
  bucket: string
  used_in: string[]
}
