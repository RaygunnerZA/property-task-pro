import type {
  SalesActivity,
  SalesAsset,
  SalesCompliance,
  SalesContact,
  SalesConversation,
  SalesDataset,
  SalesFile,
  SalesProperty,
  SalesRecord,
  SalesSignal,
  SalesSpace,
  SalesTask,
  SalesTaskPriority,
  SalesTaskStatus,
} from "@/lib/demo/sales/types";
import { DOCUMENT_CATEGORIES } from "@/lib/demo/sales/types";

const PASSWORD = "env:DEMO_PASSWORD";

export type SpaceSeed = [string, string, string];
export type AssetSeed = [string, string, string, string, string, number, string];

export function spaces(propertyKey: string, rows: SpaceSeed[]): SalesSpace[] {
  return rows.map(([slug, name, icon]) => ({
    key: `space.${propertyKey}.${slug}`,
    name,
    icon_name: icon,
  }));
}

export function assets(propertyKey: string, rows: AssetSeed[]): SalesAsset[] {
  return rows.map(([slug, name, spaceSlug, group, category, condition, notes], index) => ({
    key: `asset.${propertyKey}.${slug}`,
    name,
    spaceKey: `space.${propertyKey}.${spaceSlug}`,
    group,
    asset_type: category,
    category,
    condition_score: condition,
    status: "active",
    icon_name: index % 2 === 0 ? "package" : "wrench",
    notes,
    warranty_offset_days: condition > 80 ? 400 : condition < 60 ? -30 : 180,
  }));
}

export function task(input: SalesTask): SalesTask {
  return input;
}

export type Job = {
  slug: string;
  title: string;
  description: string;
  status: SalesTaskStatus;
  priority: SalesTaskPriority;
  due: number;
  created: number;
  completed?: number;
  space: string;
  asset: string;
  type?: string;
  recurrence?: SalesTask["recurrence"];
  contractor?: string;
};

export function jobsToTasks(
  propertyKey: string,
  assignee: string,
  contractor: string,
  rows: Job[]
): SalesTask[] {
  return rows.map((row) =>
    task({
      key: `task.${propertyKey}.${row.slug}`,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      type: row.type ?? (row.status === "completed" ? "maintenance" : "repair"),
      is_compliance: false,
      due_offset_days: row.due,
      created_offset_days: row.created,
      completed_offset_days: row.completed,
      updated_offset_days: row.completed ?? Math.max(row.created, Math.min(row.due, -1)),
      assigned_user_key: assignee,
      contractor_key: row.contractor ?? contractor,
      space_keys: [`space.${propertyKey}.${row.space}`],
      asset_keys: [`asset.${propertyKey}.${row.asset}`],
      recurrence: row.recurrence,
    })
  );
}

function record(input: SalesRecord): SalesRecord {
  return input;
}

export function sheet(input: {
  key: string;
  title: string;
  category: string;
  document_type: string;
  issuer: string;
  reference: string;
  notes: string;
  lines: string[];
  created: number;
  expiry?: number;
  spaceKey?: string;
  assetKey?: string;
  parent?: "property" | "task";
  taskKey?: string;
}): { file: SalesFile; record: SalesRecord } {
  const fileKey = `file.${input.key}`;
  return {
    file: {
      key: fileKey,
      file_name: `${input.key}.svg`,
      mime: "image/svg+xml",
      kind: "record",
      eyebrow: input.category,
      title: input.title,
      issuer: input.issuer,
      reference: input.reference,
      dateLabel: input.expiry != null ? `Due offset ${input.expiry} days` : "Filed",
      lines: input.lines,
    },
    record: record({
      key: `record.${input.key}`,
      fileKey,
      title: input.title,
      file_name: `${input.reference}.svg`,
      category: input.category,
      document_type: input.document_type,
      notes: input.notes,
      issuer: input.issuer,
      reference: input.reference,
      parent: input.parent ?? "property",
      taskKey: input.taskKey,
      spaceKey: input.spaceKey,
      assetKey: input.assetKey,
      expiry_offset_days: input.expiry,
      created_offset_days: input.created,
    }),
  };
}

export function signal(input: SalesSignal): SalesSignal {
  return input;
}

export function activity(propertyKey: string, index: number, summary: string, days: number, taskKey?: string): SalesActivity {
  return {
    key: `activity.${propertyKey}.${index}`,
    action: "updated",
    entity_type: "task",
    taskKey,
    summary,
    created_offset_days: days,
  };
}

const HOME_SPACES: SpaceSeed[] = [
  ["kitchen", "Kitchen", "cooking-pot"],
  ["living", "Living room", "sofa"],
  ["dining", "Dining room", "utensils"],
  ["hall", "Hall", "door-open"],
  ["main-bedroom", "Main bedroom", "bed-double"],
  ["second-bedroom", "Second bedroom", "bed-single"],
  ["bathroom", "Family bathroom", "bath"],
  ["landing", "Landing", "stairs"],
  ["loft", "Loft", "warehouse"],
  ["utility", "Utility", "washing-machine"],
  ["garden", "Garden", "trees"],
  ["garage", "Garage", "car"],
];

const HOME_ASSETS: AssetSeed[] = [
  ["boiler", "Worcester Greenstar combi", "kitchen", "heating", "Heating", 64, "Serves heating and hot water. Last repressurised in the spring."],
  ["cylinder", "Hot water cylinder", "utility", "heating", "Heating", 78, "Unvented cylinder with a yearly service."],
  ["radiator-living", "Living room radiator", "living", "heating", "Heating", 84, "Thermostatic valve sticks in cold weather."],
  ["supply-pipe", "Kitchen supply pipe", "kitchen", "plumbing", "Plumbing", 58, "Copper feed under the sink. A joint is weeping."],
  ["stopcock", "Mains stopcock", "utility", "plumbing", "Plumbing", 90, "Turns freely. Labelled on the utility wall."],
  ["basin-trap", "Bathroom basin trap", "bathroom", "plumbing", "Plumbing", 72, "Replaced after a slow drain last winter."],
  ["consumer-unit", "Consumer unit", "hall", "electrical", "Electrical", 70, "Split load board in the hall cupboard."],
  ["kitchen-circuit", "Kitchen ring circuit", "kitchen", "electrical", "Electrical", 80, "Serves the oven and the small appliances."],
  ["loft-lights", "Loft lighting circuit", "loft", "electrical", "Electrical", 75, "LED battens on the loft walkway."],
  ["smoke-hall", "Hall smoke alarm", "hall", "alarms", "Safety", 88, "Mains alarm with a sealed battery."],
  ["smoke-landing", "Landing smoke alarm", "landing", "alarms", "Safety", 86, "Interlinked with the hall alarm."],
  ["co-kitchen", "Kitchen carbon monoxide alarm", "kitchen", "alarms", "Safety", 91, "Mounted beside the boiler flue."],
  ["roof-covering", "Main roof covering", "loft", "roof", "Roof", 66, "Concrete tiles. A few slipped tiles on the north slope."],
  ["gutters", "Front gutter run", "garden", "roof", "Roof", 62, "Cleared each autumn. One joint weeps in heavy rain."],
  ["front-door", "Front door", "hall", "doors", "Joinery", 77, "Timber door with a five-lever lock."],
  ["kitchen-window", "Kitchen window", "kitchen", "doors", "Joinery", 73, "Casement. The trickle vent is stiff."],
  ["patio-door", "Dining room patio door", "dining", "doors", "Joinery", 69, "Aluminium slider. Track needs a seasonal clean."],
  ["oven", "Kitchen oven", "kitchen", "appliances", "Appliance", 81, "Built-in electric oven."],
  ["hob", "Induction hob", "kitchen", "appliances", "Appliance", 85, "Four-zone hob."],
  ["fridge", "Fridge freezer", "kitchen", "appliances", "Appliance", 74, "Tall fridge freezer in the tall unit."],
  ["washer", "Washing machine", "utility", "appliances", "Appliance", 68, "Front loader. Door seal replaced last year."],
  ["dishwasher", "Dishwasher", "kitchen", "appliances", "Appliance", 79, "Integrated dishwasher."],
  ["alarm-panel", "Intruder alarm panel", "hall", "security", "Security", 83, "Bell box on the front elevation."],
  ["door-sensor", "Front door contact", "hall", "security", "Security", 87, "Paired to the hall panel."],
  ["router", "Broadband router", "living", "internet", "Network", 90, "Sits on the living room shelf."],
  ["access-point", "Landing access point", "landing", "internet", "Network", 88, "Extends the network upstairs."],
  ["mower", "Garden mower", "garage", "exterior", "Garden", 60, "Petrol mower. Serviced before summer."],
  ["hose", "Outside tap and hose", "garden", "exterior", "Garden", 76, "Isolated for winter."],
  ["garage-door", "Garage door", "garage", "exterior", "Garage", 71, "Up and over door. Springs are original."],
  ["thermostat", "Hall thermostat", "hall", "heating", "Heating", 82, "Sets the heating schedule for the house."],
  ["extractor", "Kitchen extractor", "kitchen", "appliances", "Appliance", 77, "Ducted to the side wall."],
  ["shower", "Bathroom shower valve", "bathroom", "plumbing", "Plumbing", 80, "Thermostatic bar valve."],
  ["porch-light", "Porch light", "hall", "electrical", "Electrical", 84, "PIR lamp over the front door."],
  ["shed-lock", "Side gate lock", "garden", "security", "Security", 73, "Key lives with the front door set."],
  ["mesh", "Landing mesh node", "landing", "internet", "Network", 89, "Second hop for the back bedroom."],
];

function homeRecords(): { files: SalesFile[]; records: SalesRecord[]; compliance: SalesCompliance[] } {
  const sheets = [
    ["plans-ground", "Plans", "Ground floor drawing", "Floor plan", "Marsh Survey", "WL-PLAN-01", "Ground floor as measured.", ["Kitchen, dining room, living room and hall."], -400],
    ["plans-first", "Plans", "First floor drawing", "Floor plan", "Marsh Survey", "WL-PLAN-02", "First floor as measured.", ["Bedrooms, bathroom, landing and loft hatch."], -400],
    ["plans-pipe", "Plans", "Kitchen pipe route", "Services drawing", "Hale Plumbing", "WL-PIPE-14", "Cold feed route under the sink.", ["Stopcock to the kitchen supply pipe."], -20, undefined, "space.home.kitchen", "asset.home.supply-pipe"],
    ["legal-title", "Legal", "Title register", "Ownership", "HM Land Registry", "WL-TITLE-18", "Registered title for 14 Willow Lane.", ["Proprietor: Elena Marsh."], -600],
    ["legal-planning", "Legal", "Planning decision notice", "Planning", "Bristol City Council", "WL-PLANNING-4", "Rear window replacement.", ["Approved scheme for the kitchen window."], -500],
    ["fire-alarm", "Fire Safety", "Smoke alarm installation note", "Alarm note", "Bright & Co", "WL-ALARM-3", "Interlinked alarms in hall and landing.", ["Sealed batteries. Next check is scheduled."], -40, 200],
    ["fire-escape", "Fire Safety", "Household escape note", "Escape note", "Elena Marsh", "WL-ESCAPE-1", "Night-time exit via the hall door.", ["Keys live on the hall hook."], -30],
    ["elec-eicr", "Electrical", "Electrical condition report", "EICR", "Volt & Co", "WL-EICR-9", "Condition report for the hall board.", ["Satisfactory. Next review in two years."], -200, 400, "space.home.hall", "asset.home.consumer-unit"],
    ["elec-minor", "Electrical", "Minor works for the kitchen ring", "Minor works", "Volt & Co", "WL-MW-2", "Kitchen ring extended for the hob.", ["Circuit labelled in the hall cupboard."], -180],
    ["mech-boiler", "Mechanical", "Boiler service sheet", "Service sheet", "Hale Plumbing", "WL-BOILER-7", "Combustion check and condensate trap clean.", ["Pressure left at 1.2 bar."], -300, undefined, "space.home.kitchen", "asset.home.boiler"],
    ["mech-flue", "Mechanical", "Flue route note", "Flue note", "Hale Plumbing", "WL-FLUE-1", "Flue terminates on the side elevation.", ["Keep the terminal clear of the hedge."], -300],
    ["water-hygiene", "Water", "Water hygiene note", "Hygiene note", "Hale Plumbing", "WL-WATER-2", "Outlets flushed after a vacant fortnight.", ["Kitchen and bathroom outlets run clear."], -80],
    ["water-stopcock", "Water", "Stopcock location card", "Location card", "Elena Marsh", "WL-STOP-1", "Stopcock is under the utility sink.", ["Turn clockwise to isolate."], -10, undefined, "space.home.utility", "asset.home.stopcock"],
    ["ins-policy", "Insurance", "Buildings policy schedule", "Policy schedule", "Harbour Mutual", "WL-INS-22", "Buildings cover for the house.", ["Rebuild sum is on the schedule."], -60, 300],
    ["ins-claim", "Insurance", "Gutter claim correspondence", "Claim letter", "Harbour Mutual", "WL-CLAIM-3", "Closed claim for a slipped tile.", ["No outstanding excess."], -420],
    ["con-hale", "Contractors", "Hale Plumbing attendance note", "Attendance note", "Hale Plumbing", "WL-HALE-11", "Earlier attendance for a pressure drop.", ["No parts left on site."], -200],
    ["con-quote", "Contractors", "Roof quote", "Quotation", "Ridge & Tile", "WL-ROOF-Q", "Quote to reseat north-slope tiles.", ["Not yet instructed."], -15],
    ["war-boiler", "Warranties", "Boiler guarantee", "Guarantee", "Worcester", "WL-WAR-B", "Manufacturer guarantee for the combi.", ["Keep the annual service sheets with this guarantee."], -800, 200, "space.home.kitchen", "asset.home.boiler"],
    ["war-oven", "Warranties", "Oven guarantee", "Guarantee", "Neff", "WL-WAR-O", "Five-year guarantee on the oven.", ["Serial number is inside the door."], -400, 500],
    ["om-boiler", "O&M Manuals", "Boiler operating manual", "Manual", "Worcester", "WL-OM-B", "Lighting and pressure instructions.", ["Filling loop is under the boiler."], -800, undefined, "space.home.kitchen", "asset.home.boiler"],
    ["om-alarm", "O&M Manuals", "Alarm panel manual", "Manual", "Bright & Co", "WL-OM-A", "How to set and unset the panel.", ["User code is not written in this manual."], -200],
    ["misc-invoice", "Misc", "Previous heating invoice", "Invoice", "Hale Plumbing", "WL-INV-4", "Invoice for the spring pressure visit.", ["Paid by bank transfer."], -200],
    ["misc-energy", "Misc", "Energy performance summary", "Energy", "Elm Assessors", "WL-EPC-6", "Energy summary for the house.", ["Loft insulation is the main opportunity."], -100, 2400],
    ["misc-letter", "Misc", "Neighbour fence letter", "Correspondence", "Elena Marsh", "WL-LET-2", "Agreed the shared fence repair.", ["Ridge & Tile to supply the posts."], -50],
    ["misc-photo-gutter", "Misc", "Gutter joint photograph", "Photograph", "Elena Marsh", "WL-PHO-1", "Weeping joint above the bay.", ["Taken after heavy rain."], -12, undefined, "space.home.garden", "asset.home.gutters"],
    ["misc-receipt", "Misc", "Appliance filter receipt", "Receipt", "Home Appliance Care", "WL-REC-8", "Filters for the washer and dishwasher.", ["Paid on the day."], -45],
    ["legal-deed", "Legal", "Fence boundary note", "Boundary", "Elena Marsh", "WL-FENCE-1", "Agreed line of the shared fence.", ["Posts sit on the Willow Lane side."], -50],
    ["plans-loft", "Plans", "Loft hatch sketch", "Sketch", "Elena Marsh", "WL-LOFT-1", "Hatch position over the landing.", ["Boarded area is hatched."], -20, undefined, "space.home.loft"],
    ["fire-blanket", "Fire Safety", "Kitchen blanket location", "Location note", "Elena Marsh", "WL-BLANKET-1", "Fire blanket hangs beside the hob.", ["Checked when the hob was installed."], -430],
  ] as const;

  const files: SalesFile[] = [];
  const records: SalesRecord[] = [];
  for (const row of sheets) {
    const [slug, category, title, documentType, issuer, reference, notes, lines, created, expiry, spaceKey, assetKey] = row as unknown as [
      string, string, string, string, string, string, string, string[], number, number | undefined, string | undefined, string | undefined,
    ];
    const built = sheet({
      key: `home.${slug}`,
      title,
      category,
      document_type: documentType,
      issuer,
      reference,
      notes,
      lines,
      created,
      expiry,
      spaceKey,
      assetKey,
    });
    files.push(built.file);
    records.push(built.record);
  }

  const leak: SalesFile = {
    key: "file.home.leak-photo",
    file_name: "kitchen-supply-leak.svg",
    mime: "image/svg+xml",
    kind: "leak",
    caption: "Kitchen supply pipe — drip at the joint",
  };
  files.push(leak);
  records.push(
    record({
      key: "record.home.leak-photo",
      fileKey: leak.key,
      title: "Kitchen supply pipe drip",
      file_name: "kitchen-supply-leak.svg",
      category: "Misc",
      document_type: "Photograph",
      notes: "Photograph of the weeping joint under the sink.",
      issuer: "Elena Marsh",
      reference: "WL-LEAK-PHOTO",
      parent: "task",
      taskKey: "task.home.pipe-leak",
      spaceKey: "space.home.kitchen",
      assetKey: "asset.home.supply-pipe",
      created_offset_days: -1,
    })
  );

  const compliance: SalesCompliance[] = [
    {
      key: "comp.home.gas-safety",
      title: "Gas safety record",
      document_type: "Gas safety",
      notes: "Annual gas safety record for the combi and hob.",
      expiry_offset_days: 45,
      linked_asset_keys: ["asset.home.boiler"],
      created_offset_days: -320,
    },
    {
      key: "comp.home.eicr",
      title: "Electrical condition",
      document_type: "EICR",
      notes: "Hall consumer unit. Satisfactory.",
      expiry_offset_days: 420,
      linked_asset_keys: ["asset.home.consumer-unit"],
      created_offset_days: -200,
    },
    {
      key: "comp.home.alarms",
      title: "Alarm check record",
      document_type: "Alarm check",
      notes: "Hall and landing alarms sounded together.",
      expiry_offset_days: 24,
      linked_asset_keys: ["asset.home.smoke-hall"],
      created_offset_days: -40,
    },
    {
      key: "comp.home.insurance",
      title: "Buildings cover",
      document_type: "Insurance",
      notes: "Buildings policy renewal window.",
      expiry_offset_days: 26,
      linked_asset_keys: [],
      created_offset_days: -60,
    },
    {
      key: "comp.home.old-gas",
      title: "Earlier gas safety record",
      document_type: "Gas safety",
      notes: "Superseded by the current gas safety record.",
      expiry_offset_days: -400,
      linked_asset_keys: ["asset.home.boiler"],
      created_offset_days: -700,
    },
    {
      key: "comp.home.water",
      title: "Water hygiene note",
      document_type: "Water hygiene",
      notes: "Outlets flushed. No further action.",
      expiry_offset_days: 22,
      linked_asset_keys: ["asset.home.supply-pipe"],
      created_offset_days: -80,
    },
    {
      key: "comp.home.roof",
      title: "Roof visual check",
      document_type: "Roof check",
      notes: "North slope noted for a later tile reseat.",
      expiry_offset_days: 28,
      linked_asset_keys: ["asset.home.roof-covering"],
      created_offset_days: -15,
    },
    {
      key: "comp.home.window",
      title: "Window maintenance note",
      document_type: "Joinery",
      notes: "Kitchen trickle vent noted as stiff.",
      expiry_offset_days: 23,
      linked_asset_keys: ["asset.home.kitchen-window"],
      created_offset_days: -20,
    },
  ];

  return { files, records, compliance };
}

function homeTasks(): SalesTask[] {
  const heroes: SalesTask[] = [
    task({
      key: "task.home.pipe-leak",
      title: "Kitchen supply pipe leak — waiting for access",
      description: "Hale Plumbing is waiting for access before the repair under the sink can start.",
      status: "open",
      priority: "urgent",
      type: "repair",
      is_compliance: false,
      due_offset_days: 2,
      created_offset_days: -2,
      updated_offset_days: 0,
      assigned_user_key: "user.home.owner",
      contractor_key: "contact.home.hale",
      space_keys: ["space.home.kitchen"],
      asset_keys: ["asset.home.supply-pipe"],
    }),
    task({
      key: "task.home.boiler-service",
      title: "Annual boiler service",
      description: "Yearly service of the Worcester combi. Hale Plumbing is already booked in the diary.",
      status: "open",
      priority: "medium",
      type: "maintenance",
      is_compliance: false,
      due_offset_days: 8,
      created_offset_days: -12,
      updated_offset_days: -1,
      assigned_user_key: "user.home.owner",
      contractor_key: "contact.home.hale",
      space_keys: ["space.home.kitchen"],
      asset_keys: ["asset.home.boiler"],
      recurrence: { type: "yearly", interval: 1 },
    }),
  ];

  const background = jobsToTasks("home", "user.home.owner", "contact.home.hale", [
    { slug: "gutter-autumn", title: "Autumn gutter clear", description: "Clear the front gutter run before the wet weather.", status: "open", priority: "medium", due: 18, created: -6, space: "garden", asset: "gutters", recurrence: { type: "yearly", interval: 1 }, contractor: "contact.home.ridge" },
    { slug: "alarm-monthly", title: "Monthly alarm sound check", description: "Sound the hall and landing alarms and the kitchen carbon monoxide alarm.", status: "open", priority: "low", due: 12, created: -3, space: "hall", asset: "smoke-hall", recurrence: { type: "monthly", interval: 1 } },
    { slug: "mower-service", title: "Mower service before spring", description: "Blade, oil and cable check on the garden mower.", status: "open", priority: "low", due: 40, created: -4, space: "garage", asset: "mower", contractor: "contact.home.green" },
    { slug: "patio-track", title: "Clean the patio door track", description: "The dining room slider is dragging on the track.", status: "open", priority: "low", due: 9, created: -2, space: "dining", asset: "patio-door" },
    { slug: "loft-hatch", title: "Ease the loft hatch", description: "The loft hatch is stiff and needs a wax on the frame.", status: "open", priority: "low", due: -4, created: -20, space: "loft", asset: "loft-lights" },
    { slug: "washer-seal", title: "Watch the washer door seal", description: "A small weep was wiped up. Recheck after the next cycle.", status: "open", priority: "medium", due: -2, created: -9, space: "utility", asset: "washer" },
    { slug: "router-reboot", title: "Router dropped overnight", description: "The living room router needed a restart. Confirm it stays up.", status: "in_progress", priority: "low", due: 1, created: -1, space: "living", asset: "router", contractor: "contact.home.fibre" },
    { slug: "radiator-bleed", title: "Bleed the living room radiator", description: "The top of the radiator is cold in the morning.", status: "in_progress", priority: "medium", due: 3, created: -5, space: "living", asset: "radiator-living" },
    { slug: "window-vent", title: "Free the kitchen trickle vent", description: "The vent is painted slightly shut.", status: "in_progress", priority: "low", due: 6, created: -7, space: "kitchen", asset: "kitchen-window" },
    { slug: "garage-spring", title: "Garage door is heavy", description: "The up-and-over door needs two hands. Springs to be looked at.", status: "in_progress", priority: "medium", due: -6, created: -14, space: "garage", asset: "garage-door", contractor: "contact.home.ridge" },
    { slug: "hedge", title: "Cut the front hedge", description: "The hedge is shading the flue terminal.", status: "in_progress", priority: "low", due: 15, created: -8, space: "garden", asset: "gutters", contractor: "contact.home.green" },
    { slug: "dishwasher-salt", title: "Top up dishwasher salt", description: "Salt light is on.", status: "in_progress", priority: "low", due: 2, created: -1, space: "kitchen", asset: "dishwasher" },
    { slug: "alarm-battery", title: "Alarm panel shows a battery note", description: "The hall panel chirped once. Waiting on a replacement battery quote.", status: "waiting_review", priority: "medium", due: 5, created: -6, space: "hall", asset: "alarm-panel", contractor: "contact.home.bright" },
    { slug: "roof-quote", title: "Decide on the north-slope tiles", description: "Ridge & Tile quoted to reseat three tiles. Hold until Elena confirms.", status: "waiting_review", priority: "medium", due: 11, created: -15, space: "loft", asset: "roof-covering", contractor: "contact.home.ridge" },
    { slug: "insurance-question", title: "Insurance rebuild question", description: "Harbour Mutual asked whether the loft insulation was upgraded.", status: "waiting_review", priority: "low", due: 7, created: -4, space: "loft", asset: "roof-covering", contractor: "contact.home.harbour" },
    { slug: "fence", title: "Shared fence posts", description: "Neighbour agreed the posts. Waiting on timber delivery.", status: "waiting_review", priority: "low", due: 20, created: -10, space: "garden", asset: "hose" },
    { slug: "hob-scratch", title: "Hob surface mark", description: "A mark on the induction glass. Warranty question is open.", status: "waiting_review", priority: "low", due: 14, created: -9, space: "kitchen", asset: "hob" },
    { slug: "old-pressure", title: "Boiler pressure drop", description: "Heating pressure dropped overnight and was restored.", status: "completed", priority: "medium", due: -210, created: -214, completed: -210, space: "kitchen", asset: "boiler" },
    { slug: "old-pipe", title: "Earlier kitchen pipe weep", description: "A previous weep on the supply pipe was tightened.", status: "completed", priority: "high", due: -190, created: -192, completed: -188, space: "kitchen", asset: "supply-pipe" },
    { slug: "washer-repair", title: "Washer door seal replacement", description: "Door seal replaced and a cycle run.", status: "completed", priority: "medium", due: -160, created: -165, completed: -160, space: "utility", asset: "washer", contractor: "contact.home.appliance" },
    { slug: "gutter-last", title: "Last autumn gutter clear", description: "Front gutter cleared and the joint photographed.", status: "completed", priority: "low", due: -340, created: -345, completed: -340, space: "garden", asset: "gutters", contractor: "contact.home.ridge" },
    { slug: "eicr-visit", title: "Electrical condition visit", description: "Volt & Co completed the hall board review.", status: "completed", priority: "medium", due: -200, created: -210, completed: -200, space: "hall", asset: "consumer-unit", contractor: "contact.home.volt" },
    { slug: "alarm-fit", title: "Alarm installation", description: "Hall and landing alarms interlinked.", status: "completed", priority: "medium", due: -400, created: -410, completed: -400, space: "hall", asset: "smoke-hall", contractor: "contact.home.bright" },
    { slug: "router-install", title: "Broadband installation", description: "Fibre installed and the landing access point fitted.", status: "completed", priority: "low", due: -500, created: -502, completed: -500, space: "living", asset: "router", contractor: "contact.home.fibre" },
    { slug: "oven-fit", title: "Oven installation", description: "Built-in oven commissioned.", status: "completed", priority: "low", due: -430, created: -432, completed: -430, space: "kitchen", asset: "oven" },
    { slug: "patio-service", title: "Patio door service", description: "Rollers cleaned and the lock adjusted.", status: "completed", priority: "low", due: -250, created: -255, completed: -250, space: "dining", asset: "patio-door" },
    { slug: "stopcock-label", title: "Label the stopcock", description: "Stopcock labelled and the family shown how to turn it.", status: "completed", priority: "low", due: -80, created: -82, completed: -80, space: "utility", asset: "stopcock" },
    { slug: "co-fit", title: "Carbon monoxide alarm fitted", description: "Kitchen alarm mounted beside the flue.", status: "completed", priority: "medium", due: -390, created: -391, completed: -390, space: "kitchen", asset: "co-kitchen", contractor: "contact.home.bright" },
    { slug: "mower-last", title: "Last mower service", description: "Blade sharpened and oil changed.", status: "completed", priority: "low", due: -150, created: -155, completed: -150, space: "garage", asset: "mower", contractor: "contact.home.green" },
    { slug: "fridge-clean", title: "Fridge drain clear", description: "Defrost drain cleared after a puddle.", status: "completed", priority: "low", due: -70, created: -72, completed: -70, space: "kitchen", asset: "fridge" },
    { slug: "hedge-last", title: "Summer hedge cut", description: "Front hedge cut back from the flue.", status: "completed", priority: "low", due: -100, created: -102, completed: -100, space: "garden", asset: "gutters", contractor: "contact.home.green" },
    { slug: "lock-service", title: "Front door lock service", description: "Five-lever lock lubricated.", status: "completed", priority: "low", due: -60, created: -61, completed: -60, space: "hall", asset: "front-door" },
    { slug: "radiator-last", title: "Radiator valve swap", description: "Living room thermostatic valve replaced.", status: "completed", priority: "medium", due: -280, created: -285, completed: -280, space: "living", asset: "radiator-living" },
    { slug: "basin", title: "Bathroom trap clean", description: "Basin trap cleaned after a slow drain.", status: "completed", priority: "low", due: -120, created: -122, completed: -120, space: "bathroom", asset: "basin-trap" },
    { slug: "loft-lamps", title: "Loft lamp replacement", description: "Walkway battens changed to LED.", status: "completed", priority: "low", due: -220, created: -222, completed: -220, space: "loft", asset: "loft-lights", contractor: "contact.home.volt" },
    { slug: "insurance-renewed", title: "Last buildings renewal", description: "Harbour Mutual schedule filed.", status: "completed", priority: "low", due: -330, created: -335, completed: -330, space: "hall", asset: "front-door", contractor: "contact.home.harbour" },
    { slug: "dishwasher-last", title: "Dishwasher filter clean", description: "Filter cleaned and a hot cycle run.", status: "completed", priority: "low", due: -45, created: -46, completed: -45, space: "kitchen", asset: "dishwasher" },
    { slug: "hose-isolate", title: "Winter tap isolation", description: "Outside tap isolated and the hose drained.", status: "completed", priority: "low", due: -300, created: -301, completed: -300, space: "garden", asset: "hose" },
    { slug: "sensor", title: "Door contact adjusted", description: "Front door contact realigned after painting.", status: "completed", priority: "low", due: -90, created: -92, completed: -90, space: "hall", asset: "door-sensor", contractor: "contact.home.bright" },
    { slug: "archived-paint", title: "Hall paint touch-up", description: "Scuff by the alarm panel was painted out.", status: "archived", priority: "low", due: -600, created: -610, completed: -600, space: "hall", asset: "alarm-panel" },
    { slug: "archived-carpet", title: "Landing carpet grip", description: "Loose gripper at the top step was tacked down.", status: "archived", priority: "low", due: -540, created: -545, completed: -540, space: "landing", asset: "smoke-landing" },
  ]);

  background.push(
    task({
      key: "task.home.smoke-series",
      title: "Smoke and carbon monoxide check",
      description: "Press each alarm and note the result in the hall cupboard.",
      status: "open",
      priority: "medium",
      type: "maintenance",
      is_compliance: false,
      due_offset_days: 21,
      created_offset_days: -2,
      updated_offset_days: -2,
      assigned_user_key: "user.home.owner",
      contractor_key: "contact.home.bright",
      space_keys: ["space.home.landing"],
      asset_keys: ["asset.home.smoke-landing"],
      recurrence: { type: "monthly", interval: 1 },
    }),
    task({
      key: "task.home.water-series",
      title: "Flush seldom-used outlets",
      description: "Run the guest basin and the outside tap after any quiet week.",
      status: "open",
      priority: "low",
      type: "maintenance",
      is_compliance: false,
      due_offset_days: 16,
      created_offset_days: -1,
      updated_offset_days: -1,
      assigned_user_key: "user.home.owner",
      space_keys: ["space.home.bathroom"],
      asset_keys: ["asset.home.basin-trap"],
      recurrence: { type: "monthly", interval: 1 },
    }),
    task({
      key: "task.home.insurance-series",
      title: "Read the buildings schedule",
      description: "Check the rebuild figure against the loft and kitchen works.",
      status: "open",
      priority: "low",
      type: "admin",
      is_compliance: false,
      due_offset_days: 30,
      created_offset_days: -3,
      updated_offset_days: -3,
      assigned_user_key: "user.home.owner",
      contractor_key: "contact.home.harbour",
      space_keys: ["space.home.hall"],
      asset_keys: ["asset.home.front-door"],
      recurrence: { type: "yearly", interval: 1 },
    }),
    task({
      key: "task.home.appliance-series",
      title: "Clean appliance filters",
      description: "Washer, dishwasher and fridge drain on the same morning.",
      status: "open",
      priority: "low",
      type: "maintenance",
      is_compliance: false,
      due_offset_days: 25,
      created_offset_days: -2,
      updated_offset_days: -2,
      assigned_user_key: "user.home.owner",
      contractor_key: "contact.home.appliance",
      space_keys: ["space.home.utility"],
      asset_keys: ["asset.home.washer"],
      recurrence: { type: "monthly", interval: 3 },
    }),
    task({
      key: "task.home.roof-series",
      title: "Look over the roof from the garden",
      description: "Check the north slope and the front gutter from the lawn.",
      status: "open",
      priority: "medium",
      type: "maintenance",
      is_compliance: false,
      due_offset_days: 35,
      created_offset_days: -5,
      updated_offset_days: -5,
      assigned_user_key: "user.home.owner",
      contractor_key: "contact.home.ridge",
      space_keys: ["space.home.garden"],
      asset_keys: ["asset.home.roof-covering"],
      recurrence: { type: "yearly", interval: 1 },
    }),
    task({
      key: "task.home.security-series",
      title: "Walk the alarm zones",
      description: "Open and close the front door contact and unset the panel.",
      status: "in_progress",
      priority: "low",
      type: "maintenance",
      is_compliance: false,
      due_offset_days: 4,
      created_offset_days: -1,
      updated_offset_days: 0,
      assigned_user_key: "user.home.owner",
      contractor_key: "contact.home.bright",
      space_keys: ["space.home.hall"],
      asset_keys: ["asset.home.door-sensor"],
      recurrence: { type: "monthly", interval: 1 },
    }),
    task({
      key: "task.home.garden-series",
      title: "Seasonal garden close-down",
      description: "Isolate the outside tap and store the hose.",
      status: "completed",
      priority: "low",
      type: "maintenance",
      is_compliance: false,
      due_offset_days: -20,
      created_offset_days: -25,
      completed_offset_days: -18,
      updated_offset_days: -18,
      assigned_user_key: "user.home.owner",
      contractor_key: "contact.home.green",
      space_keys: ["space.home.garden"],
      asset_keys: ["asset.home.hose"],
      recurrence: { type: "yearly", interval: 1 },
    })
  );

  return [...heroes, ...background];
}

function homeConversations(): SalesConversation[] {
  return [
    {
      key: "conv.home.pipe-leak",
      taskKey: "task.home.pipe-leak",
      channel: "app",
      subject: "Kitchen supply pipe",
      messages: [
        {
          author_name: "Elena Marsh",
          author_role: "owner",
          author_user_key: "user.home.owner",
          direction: "inbound",
          source: "app",
          body: "There is a drip under the kitchen sink. I have put a bowl under the joint.",
          created_offset_hours: -30,
        },
        {
          author_name: "Hale Plumbing",
          author_role: "contractor",
          direction: "inbound",
          source: "app",
          body: "Hale Plumbing is waiting for access. Please confirm a time when someone is home.",
          created_offset_hours: -6,
        },
      ],
    },
    {
      key: "conv.home.boiler",
      taskKey: "task.home.boiler-service",
      channel: "app",
      subject: "Boiler service",
      messages: [
        {
          author_name: "Hale Plumbing",
          author_role: "contractor",
          direction: "inbound",
          source: "email",
          body: "We can service the combi next week. Morning is free.",
          created_offset_hours: -48,
        },
      ],
    },
    {
      key: "conv.home.roof",
      taskKey: "task.home.roof-quote",
      channel: "app",
      subject: "North slope",
      messages: [
        {
          author_name: "Ridge & Tile",
          author_role: "contractor",
          direction: "inbound",
          source: "email",
          body: "Quote received for three slipped tiles on the north slope.",
          created_offset_hours: -80,
        },
        {
          author_name: "Elena Marsh",
          author_role: "owner",
          author_user_key: "user.home.owner",
          direction: "outbound",
          source: "app",
          body: "Hold the tile work until I am back from the weekend.",
          created_offset_hours: -20,
        },
      ],
    },
    {
      key: "conv.home.alarm",
      taskKey: "task.home.alarm-battery",
      channel: "app",
      subject: "Panel battery",
      messages: [
        {
          author_name: "Bright & Co",
          author_role: "contractor",
          direction: "inbound",
          source: "email",
          body: "Replacement part ordered for the hall panel battery.",
          created_offset_hours: -36,
        },
      ],
    },
    {
      key: "conv.home.radiator",
      taskKey: "task.home.radiator-bleed",
      channel: "app",
      subject: "Living room radiator",
      messages: [
        {
          author_name: "Elena Marsh",
          author_role: "owner",
          author_user_key: "user.home.owner",
          direction: "inbound",
          source: "app",
          body: "The living room radiator is cold at the top again.",
          created_offset_hours: -70,
        },
      ],
    },
    {
      key: "conv.home.garage",
      taskKey: "task.home.garage-spring",
      channel: "app",
      subject: "Garage door",
      messages: [
        {
          author_name: "Ridge & Tile",
          author_role: "contractor",
          direction: "inbound",
          source: "app",
          body: "We can look at the garage springs on Thursday afternoon.",
          created_offset_hours: -10,
        },
      ],
    },
  ];
}

function homeContacts(): SalesContact[] {
  const rows: Array<[string, string, string, string, SalesContact["kind"], string]> = [
    ["hale", "Hale Plumbing", "Hale Plumbing", "Plumber", "contractor", "Heating and plumbing for the house."],
    ["ridge", "Ridge & Tile", "Ridge & Tile", "Roofer", "contractor", "Roof, gutters and the garage door."],
    ["volt", "Volt & Co", "Volt & Co", "Electrician", "contractor", "Hall board and lighting."],
    ["bright", "Bright & Co", "Bright & Co", "Alarm engineer", "contractor", "Smoke, carbon monoxide and intruder alarms."],
    ["green", "Green Acre", "Green Acre", "Gardener", "contractor", "Hedge, mower and outside tap."],
    ["appliance", "Home Appliance Care", "Home Appliance Care", "Appliance engineer", "contractor", "Washer, dishwasher and oven."],
    ["harbour", "Harbour Mutual", "Harbour Mutual", "Insurer", "agent", "Buildings policy."],
    ["fibre", "Severn Fibre", "Severn Fibre", "Broadband", "supplier", "Router and landing access point."],
    ["neighbour", "Sam Adeyemi", "Sam Adeyemi", "Neighbour", "contact", "Shares the side fence."],
    ["chemist", "Willow Pharmacy", "Willow Pharmacy", "Local contact", "other", "Key holder if Elena is away for a day."],
  ];
  return rows.map(([slug, name, , role, kind, notes]) => ({
    key: `contact.home.${slug}`,
    name,
    email: `${slug}.willow@example.com`,
    phone: "+44 117 496 0100",
    role_label: role,
    kind,
    propertyKey: "prop.home.willow",
    notes,
  }));
}

function homeSignals(): SalesSignal[] {
  const themes: SalesSignal["theme"][] = [
    "safety",
    "maintenance",
    "compliance",
    "seasonal",
    "efficiency",
    "opportunity",
    "monitoring",
  ];
  const titles = [
    "Loft insulation is thinner than the rest of the street",
    "Front gutter joint weeps in heavy rain",
    "Gas safety record is inside the next two months",
    "Outside tap should be isolated before a frost",
    "The combi short-cycles on mild afternoons",
    "A cheaper tariff may suit the induction hob",
    "Hall alarm panel chirped once",
    "North-slope tiles are still seated",
    "Kitchen trickle vent is stiff",
    "Broadband stayed up after the restart",
    "Fridge drain has stayed dry",
    "Hedge is clear of the flue",
    "Washer seal is holding",
    "Patio track was cleaned",
    "Earlier pressure visit is closed",
    "Roof quote is on hold",
    "Battery part is on order",
    "Fence posts are agreed",
    "Mower service is still ahead",
    "Landing alarm sounded with the hall",
    "Stopcock label is in place",
    "Energy summary is filed",
    "Buildings schedule question is open",
    "Garage door is heavier than last winter",
    "Living room radiator is being bled",
    "Carbon monoxide alarm is in date",
    "Second bedroom has no open repair",
    "Dining room slider lock holds",
  ];
  return titles.map((title, index) => {
    const stateCycle: SalesSignal["state"][] = ["open", "open", "open", "snoozed", "resolved", "dismissed"];
    const state = stateCycle[index % stateCycle.length]!;
    const severity: SalesSignal["severity"] =
      state === "open" && index < 6 ? "warning" : state === "open" ? "info" : "info";
    return signal({
      key: `signal.home.${index + 1}`,
      propertyKey: "prop.home.willow",
      title,
      body: `${title}. Noted for 14 Willow Lane.`,
      theme: themes[index % themes.length]!,
      state,
      severity,
      disposition: state === "dismissed" ? "dismissed" : state === "open" && severity === "warning" ? "recent" : "recent",
      created_offset_days: -index,
    });
  });
}

function homeActivity(tasks: SalesTask[]): SalesActivity[] {
  return tasks.slice(0, 22).map((row, index) =>
    activity("home", index + 1, row.title, row.updated_offset_days, row.key)
  );
}

function buildHomeProperty(): { property: SalesProperty; files: SalesFile[] } {
  const docs = homeRecords();
  const taskRows = homeTasks();
  const property: SalesProperty = {
    key: "prop.home.willow",
    address: "14 Willow Lane, Bristol, BS6 5AX",
    nickname: "14 Willow Lane",
    icon_name: "home",
    icon_color_hex: "#8EC9CE",
    owner_name: "Elena Marsh",
    owner_email: "elena.marsh@filla-demo.test",
    contact_name: "Elena Marsh",
    contact_email: "elena.marsh@filla-demo.test",
    contact_phone: "+44 117 496 0141",
    details: { site_type: "residential", ownership_type: "owned", floor_count: 2 },
    spaces: spaces("home", HOME_SPACES),
    assets: assets("home", HOME_ASSETS),
    contacts: homeContacts(),
    tasks: taskRows,
    records: docs.records,
    compliance_documents: docs.compliance,
    conversations: [
      ...homeConversations(),
      ...extraThreads("home", taskRows, "Elena Marsh", "user.home.owner", 8),
    ],
    signals: homeSignals(),
    activity: homeActivity(taskRows),
  };
  return { property, files: docs.files };
}

export function extraThreads(
  propertyKey: string,
  tasks: SalesTask[],
  author: string,
  userKey: string,
  count: number
): SalesConversation[] {
  const used = new Set(["task.home.pipe-leak", "task.home.boiler-service", "task.home.roof-quote", "task.home.alarm-battery", "task.home.radiator-bleed", "task.home.garage-spring", "task.ops.willow.pipe-leak"]);
  const picks = tasks.filter((row) => !used.has(row.key) && row.status !== "archived").slice(0, count);
  const lines = [
    "Work completed and photographed.",
    "The room was left tidy.",
    "Someone is home after 15:00.",
    "Quote received and filed.",
    "Replacement part ordered.",
    "The paperwork is filed with the other house records.",
    "Please leave the meter cupboard clear.",
    "The joint was dry this morning.",
  ];
  return picks.map((row, index) => ({
    key: `conv.${propertyKey}.extra.${index + 1}`,
    taskKey: row.key,
    channel: "app",
    subject: row.title,
    messages: [
      {
        author_name: author,
        author_role: "owner",
        author_user_key: userKey,
        direction: "inbound",
        source: "app",
        body: lines[index % lines.length]!,
        created_offset_hours: -12 - index,
      },
    ],
  }));
}

export function buildHomeOrg(): { org: SalesDataset["orgs"][number]; files: SalesFile[]; user: SalesDataset["users"][number] } {
  const built = buildHomeProperty();
  return {
    user: {
      key: "user.home.owner",
      email: "elena.marsh@filla-demo.test",
      password: PASSWORD,
      first_name: "Elena",
      last_name: "Marsh",
    },
    files: built.files,
    org: {
      key: "org.sales-home",
      name: "14 Willow Lane",
      slug: "demo-sales-home",
      org_type: "personal",
      plan_id: "home_plus",
      members: [
        {
          userKey: "user.home.owner",
          role: "owner",
          is_primary_owner: true,
          assigned_property_keys: null,
        },
      ],
      properties: [built.property],
    },
  };
}

export { DOCUMENT_CATEGORIES };
