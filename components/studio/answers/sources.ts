/** Every outside source the Answers pages cite, checked against the original on 2026-10-04. */
export type Source = { label: string; publisher: string; url: string; note: string };

export const SOURCES = {
  assemblyai: {
    label: "New 2026 insights report: What actually makes a good voice agent",
    publisher: "AssemblyAI",
    url: "https://assemblyai.com/blog/new-2026-insights-report-what-actually-makes-a-good-voice-agent",
    note: "Survey of voice agent builders: 82.5% feel confident building voice agents, 75% struggle with reliability in production; callers having to repeat themselves is the top frustration.",
  },
  groovy: {
    label: "AI Voice Agents: Build vs Buy in 2026",
    publisher: "Groovy Web",
    url: "https://www.groovyweb.co/blog/ai-voice-agents-build-vs-buy-2026",
    note: "Industry cost estimates: off-the-shelf platforms, agency builds on a platform, and fully custom builds.",
  },
  ciela: {
    label: "How Much to Charge Clients for an AI Voice Agent (2026 Pricing Guide)",
    publisher: "Ciela AI",
    url: "https://ciela.ai/blogs/how-much-to-charge-for-ai-voice-agent",
    note: "Typical agency pricing for single-purpose voice agents: setup fees and monthly retainers.",
  },
  aira: {
    label: "AI Receptionist Pricing Models Compared (2026)",
    publisher: "Aira",
    url: "https://www.getaira.io/blog/ai-receptionist-pricing-guide",
    note: "Published plan prices for off-the-shelf AI receptionist services.",
  },
  euAiAct: {
    label: "EU AI Act: Transparency Obligations Take Effect 2 August 2026",
    publisher: "Cooley",
    url: "https://www.cooley.com/news/insight/2026/2026-08-03-eu-ai-act-transparency-obligations-take-effect-2-august-2026",
    note: "Article 50 requires that people be told they are interacting with an AI system, unless that is obvious, from 2 August 2026.",
  },
  wiretap: {
    label: "Wiretap Laws in the United States",
    publisher: "Kilpatrick",
    url: "https://ktslaw.com/en/Insights/Alert/2024/7/Wiretap-Laws-in-the-United-States",
    note: "State-by-state chart of call recording consent rules, including all-party consent states.",
  },
  fccAiVoice: {
    label: "FCC: AI-Generated Robocalls Illegal Under the TCPA",
    publisher: "Cooley",
    url: "https://cooley.com/news/insight/2024/2024-02-15-fcc-ai-generated-robocalls-illegal-under-the-tcpa",
    note: "February 2024 FCC ruling: AI-generated voices are \"artificial\" voices under the Telephone Consumer Protection Act.",
  },
  fccPorting: {
    label: "Porting: Keeping Your Phone Number When You Change Providers",
    publisher: "Federal Communications Commission",
    url: "https://www.fcc.gov/consumers/guides/porting-keeping-your-phone-number-when-you-change-providers",
    note: "Consumer guide to keeping an existing number when switching providers in the same area.",
  },
  twilio10dlc: {
    label: "Pricing and Fees for A2P 10DLC Service",
    publisher: "Twilio",
    url: "https://support.twilio.com/hc/en-us/articles/1260803965530-Pricing-and-Fees-for-A2P-10DLC-Service",
    note: "Carrier registration fees for business texting on US local numbers.",
  },
  hhs: {
    label: "Covered Entities and Business Associates",
    publisher: "U.S. Department of Health and Human Services",
    url: "https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html",
    note: "Who HIPAA applies to: health plans, health care clearinghouses and health care providers for people, plus their business associates.",
  },
} satisfies Record<string, Source>;

export type SourceKey = keyof typeof SOURCES;
