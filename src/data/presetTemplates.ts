import type { ChecklistTemplateCategory } from "@/hooks/useChecklistTemplates";

export interface PresetItem {
  title: string;
  is_yes_no: boolean;
  requires_signature: boolean;
}

export interface PresetTemplate {
  id: string; // stable slug id — never changes
  name: string;
  category: ChecklistTemplateCategory;
  description: string;
  items: PresetItem[];
}

const yn = (title: string): PresetItem => ({ title, is_yes_no: true, requires_signature: false });
const sig = (title: string): PresetItem => ({ title, is_yes_no: false, requires_signature: true });
const item = (title: string): PresetItem => ({ title, is_yes_no: false, requires_signature: false });

export const PRESET_TEMPLATES: PresetTemplate[] = [
  // ─── COMPLIANCE ───────────────────────────────────────────────
  {
    id: "preset-gas-safety-check",
    name: "Gas Safety Check",
    category: "compliance",
    description: "Annual CP12 gas safety inspection for landlords.",
    items: [
      item("Book registered Gas Safe engineer"),
      yn("All gas appliances tested and in safe working order"),
      yn("Boiler pressure and controls checked"),
      yn("Flues and ventilation unobstructed"),
      yn("Carbon monoxide detector present and tested"),
      sig("Gas Safety Record (CP12) issued to tenant"),
      item("Copy of CP12 filed in compliance portfolio"),
      yn("Previous year's CP12 checked for outstanding actions"),
    ],
  },
  {
    id: "preset-fire-risk-assessment",
    name: "Fire Risk Assessment",
    category: "compliance",
    description: "Periodic fire safety review for HMOs and managed properties.",
    items: [
      yn("Smoke alarms on every floor tested and working"),
      yn("Carbon monoxide alarm present in rooms with solid fuel appliances"),
      yn("Fire escape routes clear and unobstructed"),
      yn("Fire extinguishers in date and accessible"),
      yn("Fire doors self-closing and latching correctly"),
      yn("Emergency lighting tested"),
      item("Record any remedial actions required"),
      sig("Assessment report signed by assessor"),
      item("Copy of report shared with tenants"),
    ],
  },
  {
    id: "preset-eicr",
    name: "Electrical Safety Inspection (EICR)",
    category: "compliance",
    description: "Mandatory electrical installation condition report every 5 years.",
    items: [
      item("Book NICEIC / NAPIT registered electrician"),
      yn("Consumer unit / fuse board inspected"),
      yn("All circuits tested for continuity and insulation"),
      yn("RCD protection present and tested"),
      yn("No C1 (danger present) or C2 (potentially dangerous) codes"),
      sig("EICR certificate issued"),
      item("Remedial works completed for any C1/C2 codes"),
      item("Copy of EICR provided to tenant within 28 days"),
      item("EICR filed in compliance portfolio"),
    ],
  },
  {
    id: "preset-legionella-risk",
    name: "Legionella Risk Assessment",
    category: "compliance",
    description: "Water hygiene risk assessment to comply with HSE L8.",
    items: [
      yn("Water system schematic reviewed and up to date"),
      yn("Hot water cylinder set to ≥60°C"),
      yn("Cold water stored below 20°C"),
      yn("Infrequently used outlets flushed weekly during void periods"),
      yn("Showerheads descaled and disinfected"),
      yn("Dead legs identified and removed or flushed"),
      item("Risk rating documented (low / medium / high)"),
      sig("Assessment signed by competent person"),
      item("Next review date scheduled"),
    ],
  },
  {
    id: "preset-epc",
    name: "EPC Review & Compliance",
    category: "compliance",
    description: "Ensure the property meets minimum energy efficiency standards (EPC ≥ E).",
    items: [
      item("Obtain current EPC certificate"),
      yn("EPC rating is E or above"),
      yn("EPC provided to tenant at start of tenancy"),
      item("Review recommended improvement measures"),
      yn("Loft insulation meets minimum 270mm depth"),
      yn("Cavity wall insulation installed where possible"),
      yn("Heating controls (thermostat, TRVs) present"),
      item("Schedule any improvement works if rating below E"),
      item("Updated EPC obtained after works"),
    ],
  },

  // ─── MAINTENANCE ──────────────────────────────────────────────
  {
    id: "preset-boiler-service",
    name: "Boiler Annual Service",
    category: "maintenance",
    description: "Yearly boiler service to maintain warranty and efficiency.",
    items: [
      item("Book Gas Safe registered engineer"),
      yn("Boiler ignition and burner inspected"),
      yn("Heat exchanger inspected and cleaned"),
      yn("Flue and combustion analysis checked"),
      yn("System pressure set to 1–1.5 bar"),
      yn("Expansion vessel pressure checked"),
      yn("Radiators balanced and bled"),
      yn("Controls and thermostat tested"),
      sig("Service record signed by engineer"),
      item("Service sticker affixed to boiler"),
    ],
  },
  {
    id: "preset-quarterly-inspection",
    name: "Quarterly Property Inspection",
    category: "maintenance",
    description: "Routine check to catch maintenance issues early.",
    items: [
      yn("Exterior: gutters and downpipes clear"),
      yn("Roof: no missing or damaged tiles visible"),
      yn("Windows and doors: seals intact, no draughts"),
      yn("Damp or mould — none detected"),
      yn("Boiler pressure within normal range"),
      yn("Smoke and CO alarms tested"),
      yn("All taps, showers, and toilets functioning"),
      yn("No signs of pest activity"),
      item("Meter readings recorded"),
      item("List any required remedial works"),
      item("Follow-up tasks raised for each issue found"),
    ],
  },
  {
    id: "preset-eot-inspection",
    name: "End-of-Tenancy Inspection",
    category: "maintenance",
    description: "Thorough check-out inspection to record property condition.",
    items: [
      item("Compare condition against check-in inventory"),
      yn("All keys returned"),
      yn("Property cleaned to professional standard"),
      yn("Walls, ceilings, and floors — condition noted"),
      yn("Kitchen appliances cleaned and working"),
      yn("Bathroom grout and sealant in good condition"),
      yn("Garden / outdoor areas tidy"),
      yn("All fixtures and fittings present and undamaged"),
      yn("No unauthorised alterations"),
      item("Photograph all rooms and document any damage"),
      item("Meter readings taken"),
      item("Deposit deductions list prepared if applicable"),
    ],
  },
  {
    id: "preset-roof-gutters",
    name: "Roof & Guttering Check",
    category: "maintenance",
    description: "Annual inspection to prevent water ingress and damp.",
    items: [
      yn("Roof tiles: none missing, cracked, or displaced"),
      yn("Ridge and hip tiles pointed and secure"),
      yn("Chimney stack and flashing intact"),
      yn("Gutters clear of debris and leaves"),
      yn("Downpipes flowing freely — no blockages"),
      yn("Fascia and soffit boards in good condition"),
      yn("No water staining on exterior walls"),
      item("Schedule repairs for any defects found"),
    ],
  },
  {
    id: "preset-plumbing-check",
    name: "Plumbing & Drainage Check",
    category: "maintenance",
    description: "Identify leaks, blockages, and water pressure issues.",
    items: [
      yn("All stop taps located and operating"),
      yn("No visible leaks under sinks or at pipework"),
      yn("Hot and cold water pressure adequate at all outlets"),
      yn("All drains and waste pipes flowing freely"),
      yn("No signs of damp or water damage around pipes"),
      yn("Water meter reading taken"),
      yn("Outside tap isolated for winter if applicable"),
      item("Raise work orders for any issues"),
    ],
  },

  // ─── SECURITY ─────────────────────────────────────────────────
  {
    id: "preset-lock-change",
    name: "Lock Change & Key Handover",
    category: "security",
    description: "Carried out at start of each new tenancy.",
    items: [
      item("Replace all external door locks"),
      item("Replace any communal door locks if applicable"),
      yn("New keys cut — correct quantity per tenancy agreement"),
      sig("Tenant signs key receipt form"),
      item("Spare key set stored securely in key safe or office"),
      yn("Window locks functional and keys provided"),
      yn("Letterbox secure"),
      item("Old keys destroyed or logged as void"),
    ],
  },
  {
    id: "preset-void-security",
    name: "Void Property Security Check",
    category: "security",
    description: "Protect the property between tenancies.",
    items: [
      yn("All external doors locked and deadbolted"),
      yn("All windows locked"),
      yn("Alarm system set and tested"),
      yn("No mail buildup visible from outside"),
      yn("Utilities secured — no water left running"),
      yn("Garden not overgrown"),
      yn("Property appears occupied (timer lights set if long void)"),
      item("Void inspection logged with date and inspector name"),
      item("Next void check date scheduled"),
    ],
  },
  {
    id: "preset-alarm-test",
    name: "Intruder Alarm System Test",
    category: "security",
    description: "Periodic test of burglar alarm and sensors.",
    items: [
      yn("All PIR sensors triggered and registered"),
      yn("Door and window contacts working"),
      yn("Panel shows no fault lights"),
      yn("Battery backup tested"),
      yn("Remote key fobs tested"),
      yn("Alarm monitored by station — station confirmed responsive"),
      item("Service record updated"),
      item("Next service date noted"),
    ],
  },

  // ─── OPERATIONS ───────────────────────────────────────────────
  {
    id: "preset-new-tenant-move-in",
    name: "New Tenant Move-In",
    category: "operations",
    description: "Ensure a smooth and compliant start to each tenancy.",
    items: [
      yn("Tenancy agreement signed by all parties"),
      yn("Deposit protected in government-approved scheme"),
      yn("Deposit protection certificate provided to tenant"),
      yn("How to Rent guide provided"),
      yn("EPC provided"),
      yn("Gas Safety Record provided"),
      yn("EICR provided"),
      yn("Check-in inventory signed by tenant"),
      sig("Standing order / direct debit confirmed for rent"),
      item("Tenant contact details and emergency contacts on file"),
      item("Utility supplier notifications sent"),
      item("Council tax informed of new occupancy"),
      yn("Keys handed over — receipt signed"),
    ],
  },
  {
    id: "preset-move-out-walkthrough",
    name: "Move-Out Walkthrough",
    category: "operations",
    description: "Systematic checkout with tenant present.",
    items: [
      item("Walk through each room with tenant"),
      yn("All personal belongings removed"),
      yn("All keys returned"),
      item("Meter readings taken — gas, electric, water"),
      yn("Property cleaned to check-in standard"),
      item("Photographs taken of every room"),
      yn("Any agreed deductions documented and signed"),
      item("Deposit return / deduction timeline communicated"),
      item("Utility suppliers notified of tenancy end"),
      item("Council tax notified"),
    ],
  },
  {
    id: "preset-void-walkthrough",
    name: "Void Property Walkthrough",
    category: "operations",
    description: "Post-vacate inspection before re-letting.",
    items: [
      yn("All previous tenant's belongings removed"),
      item("Meter readings recorded"),
      yn("Utilities isolated or on void tariff"),
      yn("All rooms photographed"),
      item("Maintenance list compiled"),
      item("Cleaning schedule arranged"),
      item("Redecoration scope agreed"),
      item("Target re-let date set"),
    ],
  },
  {
    id: "preset-emergency-maintenance",
    name: "Emergency Maintenance Response",
    category: "operations",
    description: "Checklist for urgent out-of-hours maintenance calls.",
    items: [
      item("Log call — date, time, tenant name, property address"),
      item("Classify emergency: gas / flood / structural / no heat or hot water"),
      yn("Immediate risk to safety assessed"),
      item("Appropriate contractor contacted and ETA confirmed"),
      item("Tenant given contractor details and expected arrival"),
      yn("Issue resolved or property made safe"),
      item("Follow-up task created for full repair if temporary fix applied"),
      item("Insurance notified if applicable"),
      item("Incident logged in property record"),
    ],
  },
  {
    id: "preset-contractor-handover",
    name: "Contractor Site Handover",
    category: "operations",
    description: "Brief contractor before starting work on a property.",
    items: [
      yn("Contractor has valid insurance certificates on file"),
      yn("Scope of work agreed in writing"),
      yn("Access arrangements confirmed"),
      yn("Tenant notified of contractor attendance and dates"),
      yn("Parking and waste disposal arrangements confirmed"),
      item("Keys / access codes provided"),
      item("Emergency contact number given to contractor"),
      yn("Expected completion date agreed"),
      item("Snagging list walkthrough scheduled for completion date"),
    ],
  },
];

export const PRESET_BY_CATEGORY = PRESET_TEMPLATES.reduce<
  Record<ChecklistTemplateCategory, PresetTemplate[]>
>(
  (acc, preset) => {
    acc[preset.category].push(preset);
    return acc;
  },
  { compliance: [], maintenance: [], security: [], operations: [] }
);
