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
  servicetitanBooking: {
    label: "Call booking rates: data from 3,000+ trade businesses",
    publisher: "ServiceTitan, October 2022",
    url: "https://www.servicetitan.com/blog/data-call-booking-rates",
    note: "A typical shop booked 42% of calls in June 2022 (HVAC 38%, plumbing 43%, electrical 41%, garage door 31%). Shops with fewer than five technicians booked 24%.",
  },
  callrailConsumers: {
    label: "Missed calls cost businesses more than ever",
    publisher: "CallRail, September 2025",
    url: "https://www.callrail.com/blog/missed-calls-cost-businesses-more-than-ever",
    note: "Survey of 1,000 US consumers: 78% have abandoned a business after an unanswered call, 82% say they'll call a competitor, and 42% leave a voicemail.",
  },
  callrailBenchmark: {
    label: "CallRail benchmark report",
    publisher: "CallRail, January 2025",
    url: "https://www.callrail.com/blog/callrail-releases-benchmark-report",
    note: "From 1.1 million conversations: home services businesses missed 14% of calls, legal 28% and healthcare 32%.",
  },
  quoCallbacks: {
    label: "Small business callback statistics",
    publisher: "Quo, August 2026",
    url: "https://www.quo.com/blog/small-business-callback-statistics/",
    note: "From 16.7 million missed business calls over three months: 69% didn't get a callback within 48 hours.",
  },
  haHvac: {
    label: "HVAC repair cost",
    publisher: "HomeAdvisor, June 2026",
    url: "https://www.homeadvisor.com/cost/heating-and-cooling/repair-an-hvac-system/",
    note: "National average $350 for an HVAC repair.",
  },
  haPlumber: {
    label: "Cost to hire a plumber",
    publisher: "HomeAdvisor, June 2026",
    url: "https://www.homeadvisor.com/cost/plumbing/hire-a-plumber/",
    note: "National average $341 for a plumbing job.",
  },
  haElectrician: {
    label: "Cost to hire an electrician",
    publisher: "HomeAdvisor, June 2026",
    url: "https://www.homeadvisor.com/cost/electrical/hire-an-electrician/",
    note: "National average $351 for an electrical job.",
  },
  haRoof: {
    label: "Roof repair cost",
    publisher: "HomeAdvisor, June 2026",
    url: "https://www.homeadvisor.com/cost/roofing/repair-a-roof/",
    note: "National average $1,174 for a roof repair.",
  },
  haGarage: {
    label: "Garage door repair cost",
    publisher: "HomeAdvisor, June 2026",
    url: "https://www.homeadvisor.com/cost/garages/repair-a-garage-door/",
    note: "National average $265 for a garage door repair.",
  },
  haPest: {
    label: "Pest control cost",
    publisher: "HomeAdvisor, June 2026",
    url: "https://www.homeadvisor.com/cost/environmental-safety/hire-an-insect-control-service/",
    note: "National average $172 per pest control visit.",
  },
  partstech: {
    label: "State of general auto repair shops 2025",
    publisher: "PartsTech, 2025",
    url: "https://get.partstech.com/report2025",
    note: "Survey of 752 shops: the most common average repair order was $500 to $749.",
  },
} satisfies Record<string, Source>;

export type SourceKey = keyof typeof SOURCES;
