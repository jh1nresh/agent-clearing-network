import matter from "gray-matter";
import { z } from "zod";

export const SKILL_CATEGORIES = [
  "Trading",
  "Security",
  "Content",
  "DeFi",
  "Analytics",
  "Infra",
  "Social",
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

const SkillFrontmatterSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(280),
  category: z.enum(SKILL_CATEGORIES),
  price: z.number().nonnegative(),
  icon: z.string().emoji().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  long_description: z.string().optional(),
  endpoint_url: z.string().url().optional(),
});

export type SkillMdParsed = {
  name: string;
  description: string;
  longDescription?: string;
  category: SkillCategory;
  price: number;
  icon?: string;
  tags: string;
  fileContent: string;
  endpointUrl?: string;
};

export function parseSkillMd(raw: string): SkillMdParsed {
  const { data, content } = matter(raw);
  const fm = SkillFrontmatterSchema.parse(data);

  const tags = Array.isArray(fm.tags)
    ? fm.tags.join(", ")
    : (fm.tags ?? "").toString();

  return {
    name: fm.name,
    description: fm.description,
    longDescription: fm.long_description,
    category: fm.category,
    price: fm.price,
    icon: fm.icon,
    tags,
    fileContent: content.trim(),
    endpointUrl: fm.endpoint_url,
  };
}
