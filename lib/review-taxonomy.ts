export const REVIEW_CATEGORIES = [
  "AI tools",
  "Accounting & finance",
  "Analytics & business intelligence",
  "Business phone",
  "CMS & website builders",
  "CRM & sales",
  "Customer support",
  "Cybersecurity",
  "Design & creative",
  "Developer tools",
  "E-commerce",
  "Education",
  "Email marketing",
  "HR & recruiting",
  "Knowledge management",
  "Legal",
  "Marketing",
  "No-code & automation",
  "Productivity",
  "Project management",
  "Property management",
  "Scheduling",
  "Social media",
  "Video & audio",
] as const;

export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number];

