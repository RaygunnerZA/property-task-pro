import {
  activity,
  assets,
  extraThreads,
  jobsToTasks,
  sheet,
  signal,
  spaces,
  task,
  type AssetSeed,
  type Job,
  type SpaceSeed,
} from "@/lib/demo/sales/homeDataset";
import type {
  SalesCompliance,
  SalesContact,
  SalesConversation,
  SalesFile,
  SalesProperty,
  SalesRecord,
  SalesSignal,
  SalesTask,
  SalesTaskStatus,
  SalesUser,
} from "@/lib/demo/sales/types";

const PASSWORD = "env:DEMO_PASSWORD";

const STATUS_CYCLE: SalesTaskStatus[] = [
  "open",
  "open",
  "open",
  "open",
  "in_progress",
  "in_progress",
  "in_progress",
  "waiting_review",
  "waiting_review",
  "archived",
  "completed",
  "completed",
  "completed",
  "completed",
  "completed",
  "completed",
  "completed",
  "completed",
  "completed",
  "completed",
];

type Routine = {
  slug: string;
  title: string;
  description: string;
  space: string;
  asset: string;
  recurrence?: SalesTask["recurrence"];
  priority?: SalesTask["priority"];
};

function expandRoutines(
  propertyKey: string,
  assignee: string,
  contractor: string,
  routines: Routine[],
  salt: number
): SalesTask[] {
  const jobs: Job[] = routines.map((routine, index) => {
    const status = STATUS_CYCLE[(index + salt) % STATUS_CYCLE.length]!;
    const due =
      status === "open"
        ? index % 3 === 0
          ? -3
          : 6 + (index % 10)
        : status === "in_progress"
          ? index % 4 === 0
            ? -5
            : 4
          : status === "waiting_review"
            ? 9
            : status === "archived"
              ? -420 - index
              : -40 - index * 11;
    return {
      slug: routine.slug,
      title: routine.title,
      description: routine.description,
      status,
      priority: routine.priority ?? (index % 5 === 0 ? "high" : index % 2 === 0 ? "medium" : "low"),
      due,
      created: due - 12,
      completed: status === "completed" || status === "archived" ? due + 1 : undefined,
      space: routine.space,
      asset: routine.asset,
      recurrence: status === "open" || status === "in_progress" ? routine.recurrence : undefined,
      contractor,
    };
  });
  return jobsToTasks(propertyKey, assignee, contractor, jobs);
}

const HARBOUR_SPACES: SpaceSeed[] = [
  ["entrance", "Entrance hall", "door-open"],
  ["stairs", "Stair core", "stairs"],
  ["riser", "Riser cupboard", "columns-3"],
  ["plant", "Plant room", "heater"],
  ["bins", "Bin store", "trash-2"],
  ["bikes", "Bike store", "bike"],
  ["flat1", "Flat 1 kitchen", "cooking-pot"],
  ["flat2", "Flat 2 kitchen", "cooking-pot"],
  ["courtyard", "Courtyard", "trees"],
  ["meters", "Meter room", "gauge"],
  ["lobby", "Lift lobby", "arrow-up"],
  ["roof", "Roof", "warehouse"],
];

const HARBOUR_ASSETS: AssetSeed[] = [
  ["riser-pipe", "Communal riser pipe", "riser", "water", "Plumbing", 57, "Copper riser serving the flats. A joint on the second landing is weeping."],
  ["booster", "Cold water booster", "plant", "water", "Plumbing", 74, "Serves the upper floors."],
  ["tank", "Break tank", "plant", "water", "Plumbing", 69, "Screened lid. Checked with the water hygiene round."],
  ["communal-boiler", "Communal boiler", "plant", "heating", "Heating", 71, "Serves the entrance and circulation."],
  ["riser-valve", "Riser isolation valve", "riser", "water", "Plumbing", 80, "Labelled for each floor."],
  ["door-entry", "Door entry panel", "entrance", "access", "Access", 76, "Trades button and fob reader."],
  ["fob-reader", "Stair core fob reader", "stairs", "access", "Access", 82, "Residents enter from the courtyard."],
  ["gate", "Courtyard gate", "courtyard", "access", "Access", 68, "Closer is slow."],
  ["fire-alarm", "Communal fire alarm panel", "entrance", "safety", "Safety", 88, "Panel in the entrance cupboard."],
  ["aov", "Stair automatic vent", "stairs", "safety", "Safety", 73, "Opens from the alarm panel."],
  ["extinguisher", "Lobby extinguisher", "lobby", "safety", "Safety", 90, "Water extinguisher. Gauge in the green."],
  ["em-light", "Stair emergency light", "stairs", "safety", "Safety", 84, "Three-hour fitting."],
  ["meter-elec", "Landlord electrical meter", "meters", "safety", "Electrical", 86, "Landlord supply for circulation."],
  ["meter-gas", "Landlord gas meter", "meters", "heating", "Heating", 85, "Serves the communal boiler."],
  ["roof-outlet", "Roof rainwater outlet", "roof", "water", "Roof", 63, "One outlet holds water after heavy rain."],
  ["bin-door", "Bin store door", "bins", "access", "Access", 70, "Self-closer needs a turn of the screw."],
  ["bike-rack", "Bike rack", "bikes", "access", "Access", 77, "Twelve stands."],
  ["flat1-tap", "Flat 1 kitchen tap", "flat1", "water", "Plumbing", 81, "Resident reports a slow drip at the spout, separate from the riser."],
  ["flat2-fan", "Flat 2 extractor", "flat2", "heating", "Appliance", 79, "Ducted to the courtyard."],
  ["intercom", "Handset in flat 1", "flat1", "access", "Access", 75, "Buzzes from the entrance panel."],
  ["dry-riser", "Dry riser inlet", "courtyard", "safety", "Safety", 83, "Inlet box on the courtyard wall."],
  ["plant-light", "Plant room light", "plant", "safety", "Electrical", 88, "Bulkhead over the boiler."],
];

const CHALET_SPACES: SpaceSeed[] = [
  ["living", "Living room", "sofa"],
  ["kitchen", "Kitchen", "cooking-pot"],
  ["bedroom", "Main bedroom", "bed-double"],
  ["bunk", "Bunk room", "bed-single"],
  ["bathroom", "Bathroom", "bath"],
  ["boot", "Boot room", "footprints"],
  ["plant", "Plant cupboard", "heater"],
  ["deck", "Deck", "trees"],
  ["tub", "Hot tub terrace", "waves"],
  ["loft", "Loft", "warehouse"],
];

const CHALET_ASSETS: AssetSeed[] = [
  ["boiler", "Oil boiler", "plant", "boiler", "Heating", 66, "Serves radiators and the hot water coil."],
  ["flue", "Boiler flue", "plant", "boiler", "Heating", 72, "Terminal on the gable."],
  ["chimney", "Living room stove chimney", "living", "chimney", "Heating", 61, "Swept before the season."],
  ["stove", "Wood stove", "living", "chimney", "Heating", 70, "Used on changeover evenings."],
  ["tub", "Deck hot tub", "tub", "hot tub", "Leisure", 64, "Covered when the chalet is empty."],
  ["tub-pump", "Hot tub circulation pump", "tub", "hot tub", "Leisure", 67, "Runs a daily cycle in season."],
  ["snow-shovel", "Snow shovel set", "boot", "snow", "Seasonal", 80, "Kept by the boot room door."],
  ["roof-rake", "Roof rake", "boot", "snow", "Seasonal", 78, "Used after heavy snow on the porch."],
  ["shutters", "Storm shutters", "deck", "seasonal", "Seasonal", 74, "Closed at the end of the season."],
  ["generator", "Backup generator", "plant", "seasonal", "Electrical", 69, "Monthly start when the chalet is in use."],
  ["smoke", "Living room smoke alarm", "living", "seasonal", "Safety", 86, "Checked on every turnover."],
  ["co", "Plant cupboard carbon monoxide alarm", "plant", "boiler", "Safety", 88, "Beside the oil boiler."],
  ["tank", "Oil tank", "plant", "boiler", "Heating", 73, "Gauge read at season opening."],
  ["gutters", "Porch gutter", "deck", "seasonal", "Roof", 60, "Holds needles from the birches."],
  ["mattress", "Main bedroom mattress", "bedroom", "seasonal", "Furnishing", 82, "Protector changed each stay."],
  ["oven", "Kitchen range", "kitchen", "seasonal", "Appliance", 77, "Gas hob and electric oven."],
  ["washer", "Boot room washer", "boot", "seasonal", "Appliance", 71, "Used by the changeover team."],
  ["path-light", "Path lights", "deck", "snow", "Electrical", 75, "Low-level lights to the parking pad."],
  ["extinguisher", "Kitchen extinguisher", "kitchen", "seasonal", "Safety", 90, "Powder extinguisher by the range."],
  ["detector", "Loft heat detector", "loft", "chimney", "Safety", 84, "Linked to the living room alarm."],
];

const HOTEL_SPACES: SpaceSeed[] = [
  ["reception", "Reception", "concierge-bell"],
  ["room1", "Room 1", "bed-double"],
  ["room2", "Room 2", "bed-double"],
  ["room3", "Room 3", "bed-double"],
  ["room4", "Room 4", "bed-single"],
  ["breakfast", "Breakfast room", "coffee"],
  ["linen", "Linen room", "shirt"],
  ["plant", "Plant room", "heater"],
  ["corridor", "Guest corridor", "footprints"],
  ["stairs", "Fire stairs", "stairs"],
  ["kitchen", "Kitchen", "cooking-pot"],
  ["office", "Manager office", "briefcase"],
  ["store", "Back store", "boxes"],
  ["courtyard", "Courtyard", "trees"],
];

const HOTEL_ASSETS: AssetSeed[] = [
  ["room1-hvac", "Room 1 fan coil", "room1", "rooms", "HVAC", 78, "Guest control beside the bed."],
  ["room2-hvac", "Room 2 fan coil", "room2", "rooms", "HVAC", 74, "A little noisy on high."],
  ["room3-safe", "Room 3 safe", "room3", "rooms", "Furnishing", 88, "Reset code is with reception."],
  ["room4-kettle", "Room 4 kettle", "room4", "guest", "Appliance", 90, "Replaced last month."],
  ["linen-rack", "Linen rack", "linen", "guest", "Housekeeping", 85, "Spare sets for four rooms."],
  ["alarm-panel", "Fire alarm panel", "reception", "alarms", "Safety", 91, "Reception cupboard."],
  ["room-sounder", "Corridor sounder", "corridor", "alarms", "Safety", 87, "Linked to the reception panel."],
  ["em-stairs", "Fire stair emergency light", "stairs", "emergency lighting", "Safety", 83, "Three-hour fitting at the half landing."],
  ["em-corridor", "Corridor emergency light", "corridor", "emergency lighting", "Safety", 86, "Above the room 2 door."],
  ["exit-sign", "Courtyard exit sign", "courtyard", "emergency lighting", "Safety", 89, "Maintained from the landlord supply."],
  ["key-rack", "Reception key rack", "reception", "guest", "Operations", 92, "Spare keys in the office safe."],
  ["till", "Reception till", "reception", "guest", "Operations", 80, "End-of-day slip filed in the office."],
  ["boiler", "Domestic boiler", "plant", "guest", "Heating", 70, "Breakfast room and guest bathrooms."],
  ["dishwasher", "Kitchen dishwasher", "kitchen", "rooms", "Appliance", 76, "Breakfast service."],
  ["fridge", "Breakfast fridge", "breakfast", "guest", "Appliance", 81, "Temperature log on the door."],
  ["cctv", "Reception camera", "reception", "guest", "Security", 84, "Covers the desk, not the rooms."],
  ["wifi", "Guest network cabinet", "office", "guest", "Network", 88, "Separate from the office network."],
  ["fire-door", "Corridor fire door", "corridor", "alarms", "Safety", 72, "Closer is a little fast."],
  ["blanket", "Kitchen fire blanket", "kitchen", "alarms", "Safety", 90, "Beside the range."],
  ["ice", "Breakfast ice machine", "breakfast", "rooms", "Appliance", 65, "Needs a descale."],
  ["vacuum", "Housekeeping vacuum", "linen", "guest", "Housekeeping", 73, "Spare bags in the store."],
  ["room1-alarm", "Room 1 smoke alarm", "room1", "alarms", "Safety", 90, "Checked on departure."],
  ["stairs-sign", "Fire stair sign", "stairs", "emergency lighting", "Safety", 88, "Photo-luminescent."],
  ["plant-pump", "Heating pump", "plant", "guest", "Heating", 71, "Serves the fan coils."],
];

const OFFICE_SPACES: SpaceSeed[] = [
  ["reception", "Reception", "door-open"],
  ["office", "Open office", "briefcase"],
  ["meeting", "Meeting room", "presentation"],
  ["kitchen", "Kitchen", "cooking-pot"],
  ["comms", "Comms room", "server"],
  ["plant", "Plant room", "heater"],
  ["stairs", "Stairs", "stairs"],
  ["wc", "WC", "bath"],
  ["roof", "Roof", "warehouse"],
  ["cycle", "Cycle store", "bike"],
];

const OFFICE_ASSETS: AssetSeed[] = [
  ["ahu", "Air handling unit", "plant", "hvac", "HVAC", 68, "Serves the open office and meeting room."],
  ["fancoil", "Meeting room fan coil", "meeting", "hvac", "HVAC", 77, "A little warm on sunny afternoons."],
  ["stat", "Office thermostat", "office", "hvac", "HVAC", 84, "Locked setpoint."],
  ["fire-door-office", "Open office fire door", "office", "fire doors", "Safety", 74, "Hold-open device tied to the alarm."],
  ["fire-door-stairs", "Stair fire door", "stairs", "fire doors", "Safety", 79, "Closer adjusted last quarter."],
  ["fire-door-kitchen", "Kitchen fire door", "kitchen", "fire doors", "Safety", 81, "Seal intact."],
  ["office-lights", "Open office lights", "office", "lighting", "Electrical", 86, "LED panels on presence sensors."],
  ["meeting-lights", "Meeting room lights", "meeting", "lighting", "Electrical", 88, "Dimmer by the door."],
  ["stair-lights", "Stair lights", "stairs", "lighting", "Electrical", 83, "Two-way switching."],
  ["display", "Meeting room display", "meeting", "meeting", "AV", 80, "HDMI from the table box."],
  ["table", "Meeting table power", "meeting", "meeting", "AV", 85, "Floor box under the table."],
  ["phone", "Meeting room phone", "meeting", "meeting", "AV", 78, "Used for the owner call."],
  ["kitchen-tap", "Kitchen tap", "kitchen", "common", "Plumbing", 82, "Pantry sink."],
  ["wc-cistern", "WC cistern", "wc", "common", "Plumbing", 70, "Slow fill noted."],
  ["cycle-rack", "Cycle rack", "cycle", "common", "Access", 76, "Six stands."],
  ["roof-fan", "Roof extract fan", "roof", "hvac", "HVAC", 66, "Serves the WC."],
  ["comms-cab", "Comms cabinet", "comms", "common", "Network", 90, "Landlord switch and the tenant router."],
  ["em-light", "Stair emergency light", "stairs", "lighting", "Safety", 87, "Monthly flick test."],
  ["extinguisher", "Office extinguisher", "office", "fire doors", "Safety", 91, "CO2 beside the fire door."],
  ["alarm", "Fire alarm panel", "reception", "fire doors", "Safety", 89, "Panel behind reception."],
];

function categoryPack(
  propertyKey: string,
  place: string,
  spaceKey: string,
  assetKey: string
): { files: SalesFile[]; records: SalesRecord[] } {
  const rows: Array<[string, string, string, string, string, number, number?]> = [
    ["plans", "Plans", "Floor drawing", "Floor plan", "Northline Survey", -500],
    ["legal", "Legal", "Lease extract", "Lease", "Northline Property", -400],
    ["fire", "Fire Safety", "Fire alarm log", "Alarm log", "Lantern Safety", -30, 180],
    ["electrical", "Electrical", "Electrical condition report", "EICR", "Volt & Co", -220, 500],
    ["mechanical", "Mechanical", "Plant service sheet", "Service sheet", "Hale Plumbing", -100],
    ["water", "Water", "Water hygiene sheet", "Hygiene sheet", "Hale Plumbing", -40, 200],
    ["insurance", "Insurance", "Buildings policy schedule", "Policy schedule", "Harbour Mutual", -20, 280],
    ["contractors", "Contractors", "Contractor attendance note", "Attendance note", "Hale Plumbing", -15],
    ["warranty", "Warranties", "Plant guarantee", "Guarantee", "Manufacturer", -600, 300],
    ["manual", "O&M Manuals", "Plant operating note", "Manual", "Manufacturer", -600],
    ["invoice", "Misc", "Maintenance invoice", "Invoice", "Hale Plumbing", -25],
    ["energy", "Misc", "Energy summary", "Energy", "Elm Assessors", -90, 2000],
    ["photo", "Misc", "Condition photograph", "Photograph", "Northline Property", -8],
    ["letter", "Misc", "Owner correspondence", "Correspondence", "Northline Property", -12],
    ["survey", "Plans", "Condition survey extract", "Survey", "Marsh Survey", -300],
  ];
  const files: SalesFile[] = [];
  const records: SalesRecord[] = [];
  rows.forEach((row, index) => {
    const [slug, category, title, documentType, issuer, created, expiry] = row;
    const built = sheet({
      key: `${propertyKey}.${slug}`,
      title: `${place} — ${title}`,
      category,
      document_type: documentType,
      issuer,
      reference: `${propertyKey}-${slug}`.toUpperCase(),
      notes: `${title} for ${place}.`,
      lines: [`${place}.`, title, issuer],
      created,
      expiry,
      spaceKey,
      assetKey: index % 2 === 0 ? assetKey : undefined,
    });
    files.push(built.file);
    records.push(built.record);
  });
  return { files, records };
}

function complianceFor(
  propertyKey: string,
  assetKey: string,
  gasOffset: number
): SalesCompliance[] {
  return [
    {
      key: `comp.${propertyKey}.gas-safety`,
      title: "Gas safety record",
      document_type: "Gas safety",
      notes: "Current gas safety record.",
      expiry_offset_days: gasOffset,
      linked_asset_keys: [assetKey],
      created_offset_days: -300,
    },
    {
      key: `comp.${propertyKey}.alarms`,
      title: "Alarm check record",
      document_type: "Alarm check",
      notes: "Latest alarm sound check.",
      expiry_offset_days: propertyKey === "ops.willow" ? 120 : 24,
      linked_asset_keys: [],
      created_offset_days: -20,
    },
    {
      key: `comp.${propertyKey}.old-gas`,
      title: "Earlier gas safety record",
      document_type: "Gas safety",
      notes: "Superseded gas safety record.",
      expiry_offset_days: -420,
      linked_asset_keys: [assetKey],
      created_offset_days: -700,
    },
    {
      key: `comp.${propertyKey}.water`,
      title: "Water hygiene record",
      document_type: "Water hygiene",
      notes: "Outlets and tanks reviewed.",
      expiry_offset_days: propertyKey === "ops.willow" ? 200 : 22,
      linked_asset_keys: [],
      created_offset_days: -40,
    },
  ];
}

const HARBOUR_ROUTINES: Routine[] = [
  { slug: "gutter", title: "Clear the roof outlet", description: "Check the roof rainwater outlet after leaves.", space: "roof", asset: "roof-outlet", recurrence: { type: "yearly", interval: 1 } },
  { slug: "alarm-test", title: "Sound the communal alarm", description: "Weekly bell test from the entrance panel.", space: "entrance", asset: "fire-alarm", recurrence: { type: "weekly", interval: 1 } },
  { slug: "em-light", title: "Flick test the stair light", description: "Monthly flick test of the stair emergency light.", space: "stairs", asset: "em-light", recurrence: { type: "monthly", interval: 1 } },
  { slug: "water", title: "Water hygiene round", description: "Temperatures at the break tank and a sentinel outlet.", space: "plant", asset: "tank", recurrence: { type: "monthly", interval: 1 } },
  { slug: "fire-door", title: "Look at the bin store closer", description: "The bin store door does not always latch.", space: "bins", asset: "bin-door", recurrence: { type: "monthly", interval: 1 } },
  { slug: "boiler", title: "Communal boiler check", description: "Pressure and condensate on the plant room boiler.", space: "plant", asset: "communal-boiler", recurrence: { type: "yearly", interval: 1 } },
  { slug: "entry", title: "Door entry fob audit", description: "Remove fobs for residents who have moved.", space: "entrance", asset: "door-entry" },
  { slug: "gate", title: "Ease the courtyard gate", description: "The closer is slow in cold weather.", space: "courtyard", asset: "gate" },
  { slug: "aov", title: "Confirm the stair vent", description: "Ask the alarm engineer to drop the vent on the next visit.", space: "stairs", asset: "aov" },
  { slug: "flat1", title: "Flat 1 tap drip", description: "The kitchen spout drips. Separate from the riser.", space: "flat1", asset: "flat1-tap" },
  { slug: "meters", title: "Read the landlord meters", description: "Electric and gas meters for the service charge.", space: "meters", asset: "meter-elec", recurrence: { type: "monthly", interval: 1 } },
  { slug: "extinguisher", title: "Check the lobby extinguisher gauge", description: "Confirm the gauge is still in the green.", space: "lobby", asset: "extinguisher" },
  { slug: "bike", title: "Tidy the bike store", description: "Remove unmarked bikes after a notice on the board.", space: "bikes", asset: "bike-rack" },
  { slug: "intercom", title: "Flat 1 handset crackle", description: "The handset crackles when the entrance panel calls.", space: "flat1", asset: "intercom" },
  { slug: "dry", title: "Look at the dry riser inlet", description: "Glass is intact. Hinge is stiff.", space: "courtyard", asset: "dry-riser" },
  { slug: "fan", title: "Flat 2 extractor noisy", description: "The extractor rattles on the high setting.", space: "flat2", asset: "flat2-fan" },
  { slug: "plant-light", title: "Plant room lamp", description: "The bulkhead flickers.", space: "plant", asset: "plant-light" },
  { slug: "owner-report", title: "Monthly owner note", description: "Short note of spend and open jobs for the freeholder.", space: "entrance", asset: "fire-alarm", recurrence: { type: "monthly", interval: 1 } },
];

const CHALET_ROUTINES: Routine[] = [
  { slug: "turnover", title: "Prepare Birch Chalet for the next arrival", description: "Linen, heating and a walk-through before the guests arrive.", space: "living", asset: "mattress", priority: "high" },
  { slug: "season-open", title: "Season opening", description: "Oil level, water on, shutters open, path lights checked.", space: "plant", asset: "tank", recurrence: { type: "yearly", interval: 1 } },
  { slug: "season-close", title: "Season closing", description: "Drain the tub, isolate the outside tap and close the shutters.", space: "deck", asset: "shutters", recurrence: { type: "yearly", interval: 1 } },
  { slug: "chimney", title: "Stove chimney sweep", description: "Sweep before the first let of the season.", space: "living", asset: "chimney", recurrence: { type: "yearly", interval: 1 } },
  { slug: "tub", title: "Hot tub water change", description: "Empty, wipe and refill the tub between longer gaps.", space: "tub", asset: "tub", recurrence: { type: "monthly", interval: 1 } },
  { slug: "snow", title: "Snow kit check", description: "Shovel and roof rake are by the boot room door.", space: "boot", asset: "snow-shovel" },
  { slug: "boiler", title: "Oil boiler service", description: "Annual service of the oil boiler and flue.", space: "plant", asset: "boiler", recurrence: { type: "yearly", interval: 1 } },
  { slug: "generator", title: "Run the backup generator", description: "Monthly start while the chalet is in season.", space: "plant", asset: "generator", recurrence: { type: "monthly", interval: 1 } },
  { slug: "gutters", title: "Clear the porch gutter", description: "Birch needles sit in the porch gutter.", space: "deck", asset: "gutters" },
  { slug: "alarm", title: "Sound the living room alarm", description: "Press the alarm during turnover.", space: "living", asset: "smoke", recurrence: { type: "monthly", interval: 1 } },
  { slug: "mattress", title: "Change the mattress protector", description: "Fresh protector on the main bed.", space: "bedroom", asset: "mattress" },
  { slug: "path", title: "Path light out", description: "One low-level light on the path is dark.", space: "deck", asset: "path-light" },
  { slug: "washer", title: "Washer filter", description: "Clean the boot room washer filter after changeover.", space: "boot", asset: "washer" },
  { slug: "oven", title: "Range clean", description: "Degrease the range before the next arrival.", space: "kitchen", asset: "oven" },
  { slug: "owner-report", title: "Owner stay report", description: "Nights let, spend and anything left for the owner.", space: "living", asset: "stove", recurrence: { type: "monthly", interval: 1 } },
  { slug: "loft", title: "Loft detector battery", description: "The loft heat detector chirped once.", space: "loft", asset: "detector" },
];

const HOTEL_ROUTINES: Routine[] = [
  { slug: "alarm-check", title: "Weekly fire alarm check", description: "Sound the panel and walk the corridor sounder.", space: "reception", asset: "alarm-panel", recurrence: { type: "weekly", interval: 1 }, priority: "high" },
  { slug: "em-light", title: "Emergency light flick test", description: "Flick test the stair and corridor fittings.", space: "stairs", asset: "em-stairs", recurrence: { type: "monthly", interval: 1 } },
  { slug: "turnover", title: "Room 2 departure", description: "Linen, safe reset and a fan-coil glance.", space: "room2", asset: "room2-hvac" },
  { slug: "ice", title: "Descale the ice machine", description: "Breakfast ice machine is due a descale.", space: "breakfast", asset: "ice" },
  { slug: "fridge", title: "Breakfast fridge temperatures", description: "Log the fridge before service.", space: "breakfast", asset: "fridge", recurrence: { type: "weekly", interval: 1 } },
  { slug: "fire-door", title: "Corridor door closer", description: "The corridor fire door closes a little fast.", space: "corridor", asset: "fire-door" },
  { slug: "boiler", title: "Boiler and pump glance", description: "Pressure on the domestic boiler and the heating pump.", space: "plant", asset: "boiler", recurrence: { type: "monthly", interval: 1 } },
  { slug: "linen", title: "Linen count", description: "Four spare sets should be on the rack.", space: "linen", asset: "linen-rack" },
  { slug: "wifi", title: "Guest network cabinet", description: "Confirm the guest network came back after the overnight restart.", space: "office", asset: "wifi" },
  { slug: "safe", title: "Room 3 safe reset", description: "Reset the safe code after a guest report.", space: "room3", asset: "room3-safe" },
  { slug: "kettle", title: "Room 4 kettle", description: "The new kettle is in the room.", space: "room4", asset: "room4-kettle" },
  { slug: "vacuum", title: "Vacuum belt", description: "The housekeeping vacuum is squeaking.", space: "linen", asset: "vacuum" },
  { slug: "exit", title: "Courtyard exit sign", description: "The sign is lit. The fitting is due its yearly look.", space: "courtyard", asset: "exit-sign", recurrence: { type: "yearly", interval: 1 } },
  { slug: "handover", title: "Evening shift note", description: "Room 2 fan coil is noisy. Ice machine still to be descaled.", space: "reception", asset: "key-rack" },
  { slug: "owner-report", title: "Weekly owner note", description: "Occupancy, open rooms and spend for the owner.", space: "office", asset: "till", recurrence: { type: "weekly", interval: 1 } },
  { slug: "room1", title: "Room 1 alarm press", description: "Press the room alarm on departure.", space: "room1", asset: "room1-alarm", recurrence: { type: "weekly", interval: 1 } },
];

const OFFICE_ROUTINES: Routine[] = [
  { slug: "light-repair", title: "Replace the meeting room lamp", description: "One meeting room lamp is out above the display.", space: "meeting", asset: "meeting-lights", priority: "medium" },
  { slug: "ahu", title: "Air handling filter", description: "Quarterly filter look on the plant room unit.", space: "plant", asset: "ahu", recurrence: { type: "monthly", interval: 3 } },
  { slug: "fire-door", title: "Fire door round", description: "Office, stair and kitchen doors. Closers and seals.", space: "office", asset: "fire-door-office", recurrence: { type: "monthly", interval: 1 } },
  { slug: "em-light", title: "Emergency light flick test", description: "Flick test the stair emergency light.", space: "stairs", asset: "em-light", recurrence: { type: "monthly", interval: 1 } },
  { slug: "wc", title: "WC cistern slow fill", description: "The cistern takes a long time to refill.", space: "wc", asset: "wc-cistern" },
  { slug: "display", title: "Meeting display cable", description: "HDMI from the table box is intermittent.", space: "meeting", asset: "display" },
  { slug: "roof-fan", title: "Roof extract noisy", description: "The WC extract is loud on windy days.", space: "roof", asset: "roof-fan" },
  { slug: "lights", title: "Office sensor too eager", description: "The open office lights drop while people are still at their desks.", space: "office", asset: "office-lights" },
  { slug: "alarm", title: "Fire alarm weekly check", description: "Sound the reception panel for a short test.", space: "reception", asset: "alarm", recurrence: { type: "weekly", interval: 1 } },
  { slug: "cycle", title: "Cycle store notice", description: "Two bikes have no tag. Notice goes up on Friday.", space: "cycle", asset: "cycle-rack" },
  { slug: "stat", title: "Thermostat lock", description: "Confirm the office setpoint is still locked.", space: "office", asset: "stat" },
  { slug: "comms", title: "Comms cabinet dust", description: "Filters on the cabinet door.", space: "comms", asset: "comms-cab", recurrence: { type: "monthly", interval: 3 } },
  { slug: "kitchen", title: "Kitchen tap washer", description: "The pantry tap drips when fully open.", space: "kitchen", asset: "kitchen-tap" },
  { slug: "owner-report", title: "Monthly facilities note", description: "Open jobs, spend and the next fire-door round.", space: "reception", asset: "alarm", recurrence: { type: "monthly", interval: 1 } },
  { slug: "extinguisher", title: "Extinguisher gauge", description: "CO2 extinguisher gauge is in the green.", space: "office", asset: "extinguisher" },
  { slug: "fancoil", title: "Meeting room too warm", description: "The fan coil struggles on sunny afternoons.", space: "meeting", asset: "fancoil" },
];

function propertyBundle(input: {
  key: string;
  nickname: string;
  address: string;
  site_type: string;
  floor_count: number;
  spaces: SpaceSeed[];
  assetRows: AssetSeed[];
  routines: Routine[];
  salt: number;
  gasOffset: number;
  gasAsset: string;
  recordSpace: string;
  recordAsset: string;
}): { property: SalesProperty; files: SalesFile[] } {
  const propertyKey = input.key;
  const docs = categoryPack(propertyKey, input.nickname, `space.${propertyKey}.${input.recordSpace}`, `asset.${propertyKey}.${input.recordAsset}`);
  const taskRows = expandRoutines(propertyKey, "user.ops.manager", "contact.ops.hale", input.routines, input.salt);
  const property: SalesProperty = {
    key: `prop.${propertyKey}`,
    address: input.address,
    nickname: input.nickname,
    icon_name: "building",
    icon_color_hex: "#8EC9CE",
    owner_name: "Helen Croft",
    owner_email: "helen.croft@filla-demo.test",
    contact_name: "Nadia Okonkwo",
    contact_email: "nadia.okonkwo@filla-demo.test",
    contact_phone: "+44 117 496 0200",
    details: { site_type: input.site_type, ownership_type: "managed", floor_count: input.floor_count },
    spaces: spaces(propertyKey, input.spaces),
    assets: assets(propertyKey, input.assetRows),
    contacts: [],
    tasks: taskRows,
    records: docs.records,
    compliance_documents: complianceFor(propertyKey, `asset.${propertyKey}.${input.gasAsset}`, input.gasOffset),
    conversations: extraThreads(propertyKey, taskRows, "Nadia Okonkwo", "user.ops.manager", 8),
    signals: signalsFor(propertyKey, input.nickname, propertyKey !== "ops.willow"),
    activity: taskRows.slice(0, 12).map((row, index) => activity(propertyKey, index + 1, row.title, row.updated_offset_days, row.key)),
  };
  return { property, files: docs.files };
}

function signalsFor(propertyKey: string, place: string, allowWarning: boolean): SalesSignal[] {
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
    `${place} circulation temperature is steady`,
    `${place} has an open maintenance note`,
    `${place} gas safety record is on file`,
    `${place} seasonal round is in the diary`,
    `${place} plant is short-cycling on mild days`,
    `${place} could shift the overnight setpoint`,
    `${place} alarm panel is quiet`,
    `${place} meter read is filed`,
    `${place} earlier repair is closed`,
    `${place} quote is waiting on the owner`,
    `${place} filter change is done`,
    `${place} night round found nothing new`,
  ];
  return titles.map((title, index) => {
    const stateCycle: SalesSignal["state"][] = allowWarning
      ? ["open", "open", "snoozed", "resolved", "dismissed", "open"]
      : ["resolved", "dismissed", "snoozed", "open", "resolved", "dismissed"];
    const state = stateCycle[index % stateCycle.length]!;
    const warning = allowWarning && state === "open" && index < 6;
    return signal({
      key: `signal.${propertyKey}.${index + 1}`,
      propertyKey: `prop.${propertyKey}`,
      title,
      body: title,
      theme: themes[index % themes.length]!,
      state: warning ? "open" : state === "open" && !allowWarning ? "open" : state,
      severity: warning ? "warning" : "info",
      disposition: "recent",
      created_offset_days: -index * 2,
    });
  });
}

function opsContacts(): SalesContact[] {
  const rows: Array<[string, string, string, SalesContact["kind"], string, string?]> = [
    ["hale", "Hale Plumbing", "Plumber", "contractor", "Heating and plumbing across the portfolio.", "prop.ops.willow"],
    ["ridge", "Ridge & Tile", "Roofer", "contractor", "Roofs and gutters.", "prop.ops.willow"],
    ["volt", "Volt & Co", "Electrician", "contractor", "Lighting and boards.", "prop.ops.office"],
    ["lantern-safety", "Lantern Safety", "Fire engineer", "contractor", "Alarms and emergency lighting.", "prop.ops.hotel"],
    ["green", "Glenmore Care", "Chalet keeper", "contractor", "Turnover and season opening at Birch Chalet.", "prop.ops.chalet"],
    ["harbour-mutual", "Harbour Mutual", "Insurer", "agent", "Buildings policies.", undefined],
    ["occupier-1", "Ruth Keller", "Flat 1 resident", "contact", "Flat 1, Harbour House.", "prop.ops.willow"],
    ["occupier-2", "James Adeyemi", "Flat 2 resident", "contact", "Flat 2, Harbour House.", "prop.ops.willow"],
    ["owner-chalet", "Iain Brodie", "Chalet owner", "contact", "Owner of Birch Chalet.", "prop.ops.chalet"],
    ["housekeeper", "Maya Singh", "Housekeeper", "contact", "Lantern Rooms housekeeping.", "prop.ops.hotel"],
    ["night", "Owen Price", "Night manager", "contact", "Lantern Rooms evening shift.", "prop.ops.hotel"],
    ["office-tenant", "Cora Bennett", "Studio tenant", "contact", "Day-to-day contact at Northline Studio.", "prop.ops.office"],
    ["lift", "Quay Lifts", "Lift engineer", "contractor", "Harbour House stair and lobby equipment.", "prop.ops.willow"],
    ["oil", "Cairngorm Oil", "Oil supplier", "supplier", "Birch Chalet oil tank.", "prop.ops.chalet"],
    ["linen", "Bath Linen Co", "Linen supplier", "supplier", "Lantern Rooms linen.", "prop.ops.hotel"],
    ["clean", "Temple Clean", "Cleaner", "contractor", "Northline Studio common areas.", "prop.ops.office"],
    ["agent", "Quay Lettings", "Letting agent", "agent", "Harbour House resident introductions.", "prop.ops.willow"],
    ["surveyor", "Marsh Survey", "Surveyor", "supplier", "Drawings and condition notes.", undefined],
  ];
  return rows.map(([slug, name, role, kind, notes, propertyKey]) => ({
    key: `contact.ops.${slug}`,
    name,
    email: `${slug}.northline@example.com`,
    phone: "+44 117 496 0300",
    role_label: role,
    kind,
    propertyKey,
    notes,
  }));
}

function harbourHero(property: SalesProperty, files: SalesFile[]): void {
  property.tasks.unshift(
    task({
      key: "task.ops.willow.pipe-leak",
      title: "Communal riser leak — waiting for access",
      description: "Hale Plumbing is waiting for access to the riser cupboard at Harbour House.",
      status: "open",
      priority: "urgent",
      type: "repair",
      is_compliance: false,
      due_offset_days: 2,
      created_offset_days: -1,
      updated_offset_days: 0,
      assigned_user_key: "user.ops.manager",
      contractor_key: "contact.ops.hale",
      space_keys: ["space.ops.willow.riser"],
      asset_keys: ["asset.ops.willow.riser-pipe"],
    })
  );
  const leak: SalesFile = {
    key: "file.ops.leak-photo",
    file_name: "harbour-riser-leak.svg",
    mime: "image/svg+xml",
    kind: "leak",
    caption: "Harbour House riser — drip at the joint",
  };
  files.push(leak);
  property.records.push({
    key: "record.ops.leak-photo",
    fileKey: leak.key,
    title: "Riser cupboard drip",
    file_name: "harbour-riser-leak.svg",
    category: "Misc",
    document_type: "Photograph",
    notes: "Photograph of the weeping joint in the riser cupboard.",
    issuer: "Ruth Keller",
    reference: "HH-LEAK-PHOTO",
    parent: "task",
    taskKey: "task.ops.willow.pipe-leak",
    spaceKey: "space.ops.willow.riser",
    assetKey: "asset.ops.willow.riser-pipe",
    created_offset_days: -1,
  });
  const invoice = sheet({
    key: "ops.willow.invoice",
    title: "Previous heating invoice",
    category: "Misc",
    document_type: "Invoice",
    issuer: "Hale Plumbing",
    reference: "HH-INV-19",
    notes: "Last year's communal boiler attendance. Paid from the service charge.",
    lines: ["Harbour House plant room.", "Attendance and a new condensate trap.", "Paid by Northline Property."],
    created: -200,
    spaceKey: "space.ops.willow.plant",
    assetKey: "asset.ops.willow.communal-boiler",
  });
  invoice.file.key = "file.ops.willow.invoice";
  invoice.record.fileKey = "file.ops.willow.invoice";
  invoice.record.key = "record.ops.willow.invoice";
  files.push(invoice.file);
  property.records.unshift(invoice.record);
  const heroThread: SalesConversation = {
    key: "conv.ops.willow.pipe-leak",
    taskKey: "task.ops.willow.pipe-leak",
    channel: "app",
    subject: "Riser cupboard",
    messages: [
      {
        author_name: "Ruth Keller",
        author_role: "resident",
        direction: "inbound",
        source: "app",
        body: "There is water in the riser cupboard on the second landing. I have put a tray under the joint.",
        created_offset_hours: -30,
      },
      {
        author_name: "Nadia Okonkwo",
        author_role: "manager",
        author_user_key: "user.ops.manager",
        direction: "outbound",
        source: "app",
        body: "Hale is booked for the day after tomorrow. Access still needs confirming.",
        created_offset_hours: -8,
      },
      {
        author_name: "Hale Plumbing",
        author_role: "contractor",
        direction: "inbound",
        source: "app",
        body: "Waiting for access to the riser cupboard.",
        created_offset_hours: -2,
      },
    ],
  };
  property.conversations.unshift(heroThread);
}

function pinTask(property: SalesProperty, key: string, patch: Partial<SalesTask>): void {
  const row = property.tasks.find((task) => task.key === key);
  if (!row) throw new Error(`Missing ${key}`);
  Object.assign(row, patch);
}

function topUpRecurrence(properties: SalesProperty[]): void {
  const recurring = properties.flatMap((property) => property.tasks).filter((row) => row.recurrence);
  const needed = 24 - recurring.length;
  if (needed <= 0) return;
  const candidates = properties
    .flatMap((property) => property.tasks)
    .filter(
      (row) =>
        row.key !== "task.ops.willow.pipe-leak" &&
        !row.recurrence &&
        (row.status === "open" || row.status === "in_progress")
    );
  for (const row of candidates.slice(0, needed)) {
    row.recurrence = { type: "monthly", interval: 1 };
  }
}

export function buildOpsOrg(): {
  users: SalesUser[];
  files: SalesFile[];
  org: {
    key: string;
    name: string;
    slug: string;
    org_type: "business";
    plan_id: string;
    members: Array<{
      userKey: string;
      role: "owner" | "manager" | "staff";
      is_primary_owner: boolean;
      assigned_property_keys: string[] | null;
    }>;
    properties: SalesProperty[];
  };
} {
  const harbour = propertyBundle({
    key: "ops.willow",
    nickname: "Harbour House",
    address: "Harbour House, 8 Quay Street, Bristol, BS1 4RN",
    site_type: "residential",
    floor_count: 4,
    spaces: HARBOUR_SPACES,
    assetRows: HARBOUR_ASSETS,
    routines: HARBOUR_ROUTINES,
    salt: 0,
    gasOffset: 45,
    gasAsset: "communal-boiler",
    recordSpace: "plant",
    recordAsset: "communal-boiler",
  });
  harbourHero(harbour.property, harbour.files);

  const chalet = propertyBundle({
    key: "ops.chalet",
    nickname: "Birch Chalet",
    address: "Birch Chalet, Glenmore, Aviemore, PH22 1QU",
    site_type: "residential",
    floor_count: 2,
    spaces: CHALET_SPACES,
    assetRows: CHALET_ASSETS,
    routines: CHALET_ROUTINES,
    salt: 3,
    gasOffset: 50,
    gasAsset: "boiler",
    recordSpace: "plant",
    recordAsset: "boiler",
  });
  const hotel = propertyBundle({
    key: "ops.hotel",
    nickname: "The Lantern Rooms",
    address: "The Lantern Rooms, 21 King Street, Bath, BA1 1AN",
    site_type: "commercial",
    floor_count: 3,
    spaces: HOTEL_SPACES,
    assetRows: HOTEL_ASSETS,
    routines: HOTEL_ROUTINES,
    salt: 5,
    gasOffset: 55,
    gasAsset: "boiler",
    recordSpace: "plant",
    recordAsset: "boiler",
  });
  const office = propertyBundle({
    key: "ops.office",
    nickname: "Northline Studio",
    address: "Northline Studio, 4 Temple Back, Bristol, BS1 6FL",
    site_type: "commercial",
    floor_count: 2,
    spaces: OFFICE_SPACES,
    assetRows: OFFICE_ASSETS,
    routines: OFFICE_ROUTINES,
    salt: 7,
    gasOffset: 80,
    gasAsset: "ahu",
    recordSpace: "plant",
    recordAsset: "ahu",
  });
  pinTask(chalet.property, "task.ops.chalet.turnover", {
    status: "open",
    priority: "high",
    due_offset_days: 6,
    is_compliance: false,
  });
  pinTask(hotel.property, "task.ops.hotel.alarm-check", {
    status: "open",
    priority: "high",
    due_offset_days: 10,
    is_compliance: false,
  });
  pinTask(office.property, "task.ops.office.light-repair", {
    status: "open",
    priority: "medium",
    due_offset_days: 4,
    is_compliance: false,
  });
  topUpRecurrence([harbour.property, chalet.property, hotel.property, office.property]);

  const contacts = opsContacts();
  harbour.property.contacts = contacts.filter((row) => !row.propertyKey || row.propertyKey === "prop.ops.willow");

  return {
    users: [
      {
        key: "user.ops.owner",
        email: "helen.croft@filla-demo.test",
        password: PASSWORD,
        first_name: "Helen",
        last_name: "Croft",
      },
      {
        key: "user.ops.manager",
        email: "nadia.okonkwo@filla-demo.test",
        password: PASSWORD,
        first_name: "Nadia",
        last_name: "Okonkwo",
      },
      {
        key: "user.ops.staff",
        email: "tom.reeve@filla-demo.test",
        password: PASSWORD,
        first_name: "Tom",
        last_name: "Reeve",
      },
    ],
    files: [...harbour.files, ...chalet.files, ...hotel.files, ...office.files],
    org: {
      key: "org.sales-ops",
      name: "Northline Property",
      slug: "demo-sales-ops",
      org_type: "business",
      plan_id: "portfolio_6_15",
      members: [
        { userKey: "user.ops.owner", role: "owner", is_primary_owner: true, assigned_property_keys: null },
        { userKey: "user.ops.manager", role: "manager", is_primary_owner: false, assigned_property_keys: null },
        {
          userKey: "user.ops.staff",
          role: "staff",
          is_primary_owner: false,
          assigned_property_keys: ["prop.ops.willow", "prop.ops.chalet"],
        },
      ],
      properties: [harbour.property, chalet.property, hotel.property, office.property],
    },
  };
}
