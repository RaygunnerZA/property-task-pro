/** Asset mini-card art — catalog + match rules for asset names / types. */
import {
  levenshteinDistance,
  normalizeString,
} from "@/services/ai/fuzzyMatch";

const MINI_CARD_BASE = "/icons/workbench/assets";

/** Neutral fallback when nothing matches. */
const NEUTRAL_FALLBACK = `${MINI_CARD_BASE}/toolbox.png`;

/** Slug → public PNG path for every file in `public/icons/workbench/assets`. */
export const ASSET_MINI_CARD_ILLUSTRATION: Record<string, string> = {
  "acoustic-guitar": `${MINI_CARD_BASE}/acoustic-guitar.png`,
  "adjustable-wrench": `${MINI_CARD_BASE}/adjustable-wrench.png`,
  "air-conditioner": `${MINI_CARD_BASE}/air-conditioner.png`,
  "air-fryer": `${MINI_CARD_BASE}/air-fryer.png`,
  "airplane": `${MINI_CARD_BASE}/airplane.png`,
  "ankle-boots": `${MINI_CARD_BASE}/ankle-boots.png`,
  "antique-armoire": `${MINI_CARD_BASE}/antique-armoire.png`,
  "aquarium": `${MINI_CARD_BASE}/aquarium.png`,
  "artist-easel": `${MINI_CARD_BASE}/artist-easel.png`,
  "backpack": `${MINI_CARD_BASE}/backpack.png`,
  "baking-tray": `${MINI_CARD_BASE}/baking-tray.png`,
  "bar-cart": `${MINI_CARD_BASE}/bar-cart.png`,
  "barbecue-grill": `${MINI_CARD_BASE}/barbecue-grill.png`,
  "baseball-cap": `${MINI_CARD_BASE}/baseball-cap.png`,
  "baseball-glove-bat": `${MINI_CARD_BASE}/baseball-glove-bat.png`,
  "basketball": `${MINI_CARD_BASE}/basketball.png`,
  "bathroom-sink": `${MINI_CARD_BASE}/bathroom-sink.png`,
  "bed": `${MINI_CARD_BASE}/bed.png`,
  "bicycle": `${MINI_CARD_BASE}/bicycle.png`,
  "bird-cage": `${MINI_CARD_BASE}/bird-cage.png`,
  "birdhouse": `${MINI_CARD_BASE}/birdhouse.png`,
  "blender": `${MINI_CARD_BASE}/blender.png`,
  "bookcase": `${MINI_CARD_BASE}/bookcase.png`,
  "boxing-gloves": `${MINI_CARD_BASE}/boxing-gloves.png`,
  "bread-bin": `${MINI_CARD_BASE}/bread-bin.png`,
  "button-up-shirt": `${MINI_CARD_BASE}/button-up-shirt.png`,
  "candelabra": `${MINI_CARD_BASE}/candelabra.png`,
  "carved-sideboard": `${MINI_CARD_BASE}/carved-sideboard.png`,
  "casserole-dish": `${MINI_CARD_BASE}/casserole-dish.png`,
  "casual-jacket": `${MINI_CARD_BASE}/casual-jacket.png`,
  "cat-bed": `${MINI_CARD_BASE}/cat-bed.png`,
  "cat-tree": `${MINI_CARD_BASE}/cat-tree.png`,
  "ceramic-mug": `${MINI_CARD_BASE}/ceramic-mug.png`,
  "cereal-bowl": `${MINI_CARD_BASE}/cereal-bowl.png`,
  "chaise-longue": `${MINI_CARD_BASE}/chaise-longue.png`,
  "champagne-flutes": `${MINI_CARD_BASE}/champagne-flutes.png`,
  "champagne-ice-bucket": `${MINI_CARD_BASE}/champagne-ice-bucket.png`,
  "chef-knife-cutting-board": `${MINI_CARD_BASE}/chef-knife-cutting-board.png`,
  "chess-set": `${MINI_CARD_BASE}/chess-set.png`,
  "chesterfield-sofa": `${MINI_CARD_BASE}/chesterfield-sofa.png`,
  "cigar-box": `${MINI_CARD_BASE}/cigar-box.png`,
  "city-bus": `${MINI_CARD_BASE}/city-bus.png`,
  "classical-bust": `${MINI_CARD_BASE}/classical-bust.png`,
  "claw-hammer": `${MINI_CARD_BASE}/claw-hammer.png`,
  "clothes-hanger-garment": `${MINI_CARD_BASE}/clothes-hanger-garment.png`,
  "clothes-iron": `${MINI_CARD_BASE}/clothes-iron.png`,
  "clutch-purse": `${MINI_CARD_BASE}/clutch-purse.png`,
  "coffee-grinder": `${MINI_CARD_BASE}/coffee-grinder.png`,
  "coffee-maker": `${MINI_CARD_BASE}/coffee-maker.png`,
  "colander": `${MINI_CARD_BASE}/colander.png`,
  "collar": `${MINI_CARD_BASE}/collar.png`,
  "combination-pliers": `${MINI_CARD_BASE}/combination-pliers.png`,
  "compost-bin": `${MINI_CARD_BASE}/compost-bin.png`,
  "computer-monitor": `${MINI_CARD_BASE}/computer-monitor.png`,
  "computer-mouse": `${MINI_CARD_BASE}/computer-mouse.png`,
  "console-table": `${MINI_CARD_BASE}/console-table.png`,
  "cordless-power-drill": `${MINI_CARD_BASE}/cordless-power-drill.png`,
  "cork-noticeboard": `${MINI_CARD_BASE}/cork-noticeboard.png`,
  "craft-scissors-mat": `${MINI_CARD_BASE}/craft-scissors-mat.png`,
  "crystal-chandelier": `${MINI_CARD_BASE}/crystal-chandelier.png`,
  "crystal-decanter": `${MINI_CARD_BASE}/crystal-decanter.png`,
  "cutlery-set": `${MINI_CARD_BASE}/cutlery-set.png`,
  "cycling-helmet": `${MINI_CARD_BASE}/cycling-helmet.png`,
  "delivery-van": `${MINI_CARD_BASE}/delivery-van.png`,
  "designer-sunglasses": `${MINI_CARD_BASE}/designer-sunglasses.png`,
  "desk-fan": `${MINI_CARD_BASE}/desk-fan.png`,
  "desk-lamp": `${MINI_CARD_BASE}/desk-lamp.png`,
  "desktop-computer": `${MINI_CARD_BASE}/desktop-computer.png`,
  "diamond-ring": `${MINI_CARD_BASE}/diamond-ring.png`,
  "digital-camera": `${MINI_CARD_BASE}/digital-camera.png`,
  "digital-piano": `${MINI_CARD_BASE}/digital-piano.png`,
  "dining-table": `${MINI_CARD_BASE}/dining-table.png`,
  "dinner-plates": `${MINI_CARD_BASE}/dinner-plates.png`,
  "dishwasher": `${MINI_CARD_BASE}/dishwasher.png`,
  "display-cabinet": `${MINI_CARD_BASE}/display-cabinet.png`,
  "dog-bed": `${MINI_CARD_BASE}/dog-bed.png`,
  "dog-house": `${MINI_CARD_BASE}/dog-house.png`,
  "door": `${MINI_CARD_BASE}/door.png`,
  "dress": `${MINI_CARD_BASE}/dress.png`,
  "dress-shoes": `${MINI_CARD_BASE}/dress-shoes.png`,
  "drinks-cabinet": `${MINI_CARD_BASE}/drinks-cabinet.png`,
  "dumbbells": `${MINI_CARD_BASE}/dumbbells.png`,
  "dustpan-hand-brush": `${MINI_CARD_BASE}/dustpan-hand-brush.png`,
  "electric-kettle": `${MINI_CARD_BASE}/electric-kettle.png`,
  "executive-briefcase": `${MINI_CARD_BASE}/executive-briefcase.png`,
  "extension-cord": `${MINI_CARD_BASE}/extension-cord.png`,
  "feather-wand": `${MINI_CARD_BASE}/feather-wand.png`,
  "filing-cabinet": `${MINI_CARD_BASE}/filing-cabinet.png`,
  "fireplace-mantel": `${MINI_CARD_BASE}/fireplace-mantel.png`,
  "first-aid-repair-kit": `${MINI_CARD_BASE}/first-aid-repair-kit.png`,
  "flashlight": `${MINI_CARD_BASE}/flashlight.png`,
  "flat-head-screwdriver": `${MINI_CARD_BASE}/flat-head-screwdriver.png`,
  "flatbed-scanner": `${MINI_CARD_BASE}/flatbed-scanner.png`,
  "floor-plan": `${MINI_CARD_BASE}/floor-plan.png`,
  "folded-jeans": `${MINI_CARD_BASE}/folded-jeans.png`,
  "folding-room-divider": `${MINI_CARD_BASE}/folding-room-divider.png`,
  "folding-step-ladder": `${MINI_CARD_BASE}/folding-step-ladder.png`,
  "food-processor": `${MINI_CARD_BASE}/food-processor.png`,
  "food-storage-containers": `${MINI_CARD_BASE}/food-storage-containers.png`,
  "fountain-pen": `${MINI_CARD_BASE}/fountain-pen.png`,
  "four-poster-bed": `${MINI_CARD_BASE}/four-poster-bed.png`,
  "fruit-bowl": `${MINI_CARD_BASE}/fruit-bowl.png`,
  "frying-pan": `${MINI_CARD_BASE}/frying-pan.png`,
  "game-console": `${MINI_CARD_BASE}/game-console.png`,
  "garage": `${MINI_CARD_BASE}/garage.png`,
  "garden-fork": `${MINI_CARD_BASE}/garden-fork.png`,
  "garden-hose": `${MINI_CARD_BASE}/garden-hose.png`,
  "garden-parasol": `${MINI_CARD_BASE}/garden-parasol.png`,
  "garden-rake": `${MINI_CARD_BASE}/garden-rake.png`,
  "garden-shed": `${MINI_CARD_BASE}/garden-shed.png`,
  "garden-spade": `${MINI_CARD_BASE}/garden-spade.png`,
  "gemstone-earrings": `${MINI_CARD_BASE}/gemstone-earrings.png`,
  "gold-bars": `${MINI_CARD_BASE}/gold-bars.png`,
  "golf-bag-clubs": `${MINI_CARD_BASE}/golf-bag-clubs.png`,
  "gramophone": `${MINI_CARD_BASE}/gramophone.png`,
  "grand-piano": `${MINI_CARD_BASE}/grand-piano.png`,
  "grandfather-clock": `${MINI_CARD_BASE}/grandfather-clock.png`,
  "greenhouse": `${MINI_CARD_BASE}/greenhouse.png`,
  "grooming-brush": `${MINI_CARD_BASE}/grooming-brush.png`,
  "hand-trowel": `${MINI_CARD_BASE}/hand-trowel.png`,
  "handsaw": `${MINI_CARD_BASE}/handsaw.png`,
  "hanging-flower-basket": `${MINI_CARD_BASE}/hanging-flower-basket.png`,
  "harness": `${MINI_CARD_BASE}/harness.png`,
  "headphones": `${MINI_CARD_BASE}/headphones.png`,
  "high-heel-shoe": `${MINI_CARD_BASE}/high-heel-shoe.png`,
  "home-office-desk": `${MINI_CARD_BASE}/home-office-desk.png`,
  "hospital-bed": `${MINI_CARD_BASE}/hospital-bed.png`,
  "house": `${MINI_CARD_BASE}/house.png`,
  "house-slippers": `${MINI_CARD_BASE}/house-slippers.png`,
  "household-broom": `${MINI_CARD_BASE}/household-broom.png`,
  "houseplant": `${MINI_CARD_BASE}/houseplant.png`,
  "jewellery-box": `${MINI_CARD_BASE}/jewellery-box.png`,
  "jigsaw-puzzle": `${MINI_CARD_BASE}/jigsaw-puzzle.png`,
  "jump-rope": `${MINI_CARD_BASE}/jump-rope.png`,
  "kayak-paddle": `${MINI_CARD_BASE}/kayak-paddle.png`,
  "kettlebell": `${MINI_CARD_BASE}/kettlebell.png`,
  "key": `${MINI_CARD_BASE}/key.png`,
  "keyboard": `${MINI_CARD_BASE}/keyboard.png`,
  "kibble-bag": `${MINI_CARD_BASE}/kibble-bag.png`,
  "kick-scooter": `${MINI_CARD_BASE}/kick-scooter.png`,
  "knitted-sweater": `${MINI_CARD_BASE}/knitted-sweater.png`,
  "laptop": `${MINI_CARD_BASE}/laptop.png`,
  "lawn-mower": `${MINI_CARD_BASE}/lawn-mower.png`,
  "leash": `${MINI_CARD_BASE}/leash.png`,
  "leather-belt": `${MINI_CARD_BASE}/leather-belt.png`,
  "leather-wallet": `${MINI_CARD_BASE}/leather-wallet.png`,
  "light-bulb": `${MINI_CARD_BASE}/light-bulb.png`,
  "litter-box": `${MINI_CARD_BASE}/litter-box.png`,
  "luxury-handbag": `${MINI_CARD_BASE}/luxury-handbag.png`,
  "luxury-sports-car": `${MINI_CARD_BASE}/luxury-sports-car.png`,
  "luxury-watch": `${MINI_CARD_BASE}/luxury-watch.png`,
  "makeup-compact": `${MINI_CARD_BASE}/makeup-compact.png`,
  "marble-side-table": `${MINI_CARD_BASE}/marble-side-table.png`,
  "measuring-cups-spoons": `${MINI_CARD_BASE}/measuring-cups-spoons.png`,
  "metal-toolbox": `${MINI_CARD_BASE}/metal-toolbox.png`,
  "microscope": `${MINI_CARD_BASE}/microscope.png`,
  "microwave": `${MINI_CARD_BASE}/microwave.png`,
  "mixing-bowls": `${MINI_CARD_BASE}/mixing-bowls.png`,
  "model-train": `${MINI_CARD_BASE}/model-train.png`,
  "mop-bucket": `${MINI_CARD_BASE}/mop-bucket.png`,
  "motor-yacht": `${MINI_CARD_BASE}/motor-yacht.png`,
  "motorcycle": `${MINI_CARD_BASE}/motorcycle.png`,
  "neck-scarf": `${MINI_CARD_BASE}/neck-scarf.png`,
  "necktie": `${MINI_CARD_BASE}/necktie.png`,
  "office-bookshelf": `${MINI_CARD_BASE}/office-bookshelf.png`,
  "office-chair": `${MINI_CARD_BASE}/office-chair.png`,
  "ornate-mirror": `${MINI_CARD_BASE}/ornate-mirror.png`,
  "outdoor-bench": `${MINI_CARD_BASE}/outdoor-bench.png`,
  "oven": `${MINI_CARD_BASE}/oven.png`,
  "padlock": `${MINI_CARD_BASE}/padlock.png`,
  "paint-brush": `${MINI_CARD_BASE}/paint-brush.png`,
  "paint-palette": `${MINI_CARD_BASE}/paint-palette.png`,
  "paint-roller": `${MINI_CARD_BASE}/paint-roller.png`,
  "paper-shredder": `${MINI_CARD_BASE}/paper-shredder.png`,
  "passenger-train": `${MINI_CARD_BASE}/passenger-train.png`,
  "patio-chair": `${MINI_CARD_BASE}/patio-chair.png`,
  "pearl-necklace": `${MINI_CARD_BASE}/pearl-necklace.png`,
  "pedestal-dining-table": `${MINI_CARD_BASE}/pedestal-dining-table.png`,
  "perfume-bottle": `${MINI_CARD_BASE}/perfume-bottle.png`,
  "persian-rug": `${MINI_CARD_BASE}/persian-rug.png`,
  "pet-ball": `${MINI_CARD_BASE}/pet-ball.png`,
  "pet-carrier-bag": `${MINI_CARD_BASE}/pet-carrier-bag.png`,
  "pet-crate": `${MINI_CARD_BASE}/pet-crate.png`,
  "pet-food-bowl": `${MINI_CARD_BASE}/pet-food-bowl.png`,
  "pet-shampoo-bottle": `${MINI_CARD_BASE}/pet-shampoo-bottle.png`,
  "pickup-truck": `${MINI_CARD_BASE}/pickup-truck.png`,
  "plant-mister": `${MINI_CARD_BASE}/plant-mister.png`,
  "pleated-skirt": `${MINI_CARD_BASE}/pleated-skirt.png`,
  "plunger": `${MINI_CARD_BASE}/plunger.png`,
  "pottery-wheel": `${MINI_CARD_BASE}/pottery-wheel.png`,
  "potting-soil-bag": `${MINI_CARD_BASE}/potting-soil-bag.png`,
  "premium-suitcase": `${MINI_CARD_BASE}/premium-suitcase.png`,
  "printer": `${MINI_CARD_BASE}/printer.png`,
  "private-jet": `${MINI_CARD_BASE}/private-jet.png`,
  "pruning-shears": `${MINI_CARD_BASE}/pruning-shears.png`,
  "radiator": `${MINI_CARD_BASE}/radiator.png`,
  "raised-double-bowl-stand": `${MINI_CARD_BASE}/raised-double-bowl-stand.png`,
  "rectangular-planter-box": `${MINI_CARD_BASE}/rectangular-planter-box.png`,
  "refrigerator": `${MINI_CARD_BASE}/refrigerator.png`,
  "remote-control": `${MINI_CARD_BASE}/remote-control.png`,
  "roll-top-desk": `${MINI_CARD_BASE}/roll-top-desk.png`,
  "rope-chew-toy": `${MINI_CARD_BASE}/rope-chew-toy.png`,
  "round-patio-table": `${MINI_CARD_BASE}/round-patio-table.png`,
  "royal-crown": `${MINI_CARD_BASE}/royal-crown.png`,
  "sandals": `${MINI_CARD_BASE}/sandals.png`,
  "saucepan": `${MINI_CARD_BASE}/saucepan.png`,
  "scratching-post": `${MINI_CARD_BASE}/scratching-post.png`,
  "secretary-desk": `${MINI_CARD_BASE}/secretary-desk.png`,
  "sedan-car": `${MINI_CARD_BASE}/sedan-car.png`,
  "seedling-tray": `${MINI_CARD_BASE}/seedling-tray.png`,
  "sewing-machine": `${MINI_CARD_BASE}/sewing-machine.png`,
  "shower": `${MINI_CARD_BASE}/shower.png`,
  "silk-scarf": `${MINI_CARD_BASE}/silk-scarf.png`,
  "skateboard": `${MINI_CARD_BASE}/skateboard.png`,
  "skis-poles": `${MINI_CARD_BASE}/skis-poles.png`,
  "slow-cooker": `${MINI_CARD_BASE}/slow-cooker.png`,
  "small-animal-hutch": `${MINI_CARD_BASE}/small-animal-hutch.png`,
  "smart-speaker": `${MINI_CARD_BASE}/smart-speaker.png`,
  "smartphone": `${MINI_CARD_BASE}/smartphone.png`,
  "smartwatch": `${MINI_CARD_BASE}/smartwatch.png`,
  "sneakers": `${MINI_CARD_BASE}/sneakers.png`,
  "snowboard": `${MINI_CARD_BASE}/snowboard.png`,
  "soccer-ball": `${MINI_CARD_BASE}/soccer-ball.png`,
  "sofa": `${MINI_CARD_BASE}/sofa.png`,
  "spice-rack": `${MINI_CARD_BASE}/spice-rack.png`,
  "spirit-level": `${MINI_CARD_BASE}/spirit-level.png`,
  "spray-cleaning-bottle": `${MINI_CARD_BASE}/spray-cleaning-bottle.png`,
  "stairs": `${MINI_CARD_BASE}/stairs.png`,
  "stand-mixer": `${MINI_CARD_BASE}/stand-mixer.png`,
  "stationery-organizer": `${MINI_CARD_BASE}/stationery-organizer.png`,
  "stockpot": `${MINI_CARD_BASE}/stockpot.png`,
  "surfboard": `${MINI_CARD_BASE}/surfboard.png`,
  "suv": `${MINI_CARD_BASE}/suv.png`,
  "t-shirt": `${MINI_CARD_BASE}/t-shirt.png`,
  "table-lamp": `${MINI_CARD_BASE}/table-lamp.png`,
  "tablet": `${MINI_CARD_BASE}/tablet.png`,
  "tape-measure": `${MINI_CARD_BASE}/tape-measure.png`,
  "telescope": `${MINI_CARD_BASE}/telescope.png`,
  "television": `${MINI_CARD_BASE}/television.png`,
  "tennis-racket-ball": `${MINI_CARD_BASE}/tennis-racket-ball.png`,
  "terracotta-potted-plant": `${MINI_CARD_BASE}/terracotta-potted-plant.png`,
  "toaster": `${MINI_CARD_BASE}/toaster.png`,
  "toilet": `${MINI_CARD_BASE}/toilet.png`,
  "toilet-brush-holder": `${MINI_CARD_BASE}/toilet-brush-holder.png`,
  "toolbox": `${MINI_CARD_BASE}/toolbox.png`,
  "tote-bag": `${MINI_CARD_BASE}/tote-bag.png`,
  "treat-jar": `${MINI_CARD_BASE}/treat-jar.png`,
  "trousers": `${MINI_CARD_BASE}/trousers.png`,
  "tufted-ottoman": `${MINI_CARD_BASE}/tufted-ottoman.png`,
  "two-piece-suit": `${MINI_CARD_BASE}/two-piece-suit.png`,
  "umbrella": `${MINI_CARD_BASE}/umbrella.png`,
  "utensil-crock": `${MINI_CARD_BASE}/utensil-crock.png`,
  "utility-knife": `${MINI_CARD_BASE}/utility-knife.png`,
  "vacuum-cleaner": `${MINI_CARD_BASE}/vacuum-cleaner.png`,
  "wall-hook-keyring": `${MINI_CARD_BASE}/wall-hook-keyring.png`,
  "wardrobe": `${MINI_CARD_BASE}/wardrobe.png`,
  "washing-machine": `${MINI_CARD_BASE}/washing-machine.png`,
  "waste-bin": `${MINI_CARD_BASE}/waste-bin.png`,
  "water-bowl": `${MINI_CARD_BASE}/water-bowl.png`,
  "watering-can": `${MINI_CARD_BASE}/watering-can.png`,
  "wheelbarrow": `${MINI_CARD_BASE}/wheelbarrow.png`,
  "wide-brim-hat": `${MINI_CARD_BASE}/wide-brim-hat.png`,
  "wifi-router": `${MINI_CARD_BASE}/wifi-router.png`,
  "window": `${MINI_CARD_BASE}/window.png`,
  "wine-glasses": `${MINI_CARD_BASE}/wine-glasses.png`,
  "wine-rack": `${MINI_CARD_BASE}/wine-rack.png`,
  "wingback-armchair": `${MINI_CARD_BASE}/wingback-armchair.png`,
  "winter-coat": `${MINI_CARD_BASE}/winter-coat.png`,
  "winter-gloves": `${MINI_CARD_BASE}/winter-gloves.png`,
  "wire-pet-cage": `${MINI_CARD_BASE}/wire-pet-cage.png`,
  "wooden-fence-panel": `${MINI_CARD_BASE}/wooden-fence-panel.png`,
  "work-gloves": `${MINI_CARD_BASE}/work-gloves.png`,
  "yarn-basket": `${MINI_CARD_BASE}/yarn-basket.png`,
  "yoga-mat-dumbbells": `${MINI_CARD_BASE}/yoga-mat-dumbbells.png`,
};

/** Common free-text / type aliases → catalog slug. */
const ASSET_MINI_CARD_SLUG_ALIAS: Record<string, string> = {
  boiler: "radiator",
  furnace: "radiator",
  heater: "radiator",
  "water-heater": "radiator",
  "heat-pump": "air-conditioner",
  ac: "air-conditioner",
  "air-conditioning": "air-conditioner",
  "air-con": "air-conditioner",
  hvac: "air-conditioner",
  ventilation: "desk-fan",
  "ventilation-unit": "desk-fan",
  fan: "desk-fan",
  chiller: "air-conditioner",
  pump: "bathroom-sink",
  tap: "bathroom-sink",
  faucet: "bathroom-sink",
  sink: "bathroom-sink",
  wc: "toilet",
  loo: "toilet",
  cistern: "toilet",
  pipework: "adjustable-wrench",
  pipes: "adjustable-wrench",
  plumbing: "adjustable-wrench",
  electrical: "desk-lamp",
  "fuse-box": "desk-lamp",
  "consumer-unit": "desk-lamp",
  "light-fitting": "desk-lamp",
  light: "desk-lamp",
  lamp: "desk-lamp",
  socket: "desk-lamp",
  outlet: "desk-lamp",
  switch: "desk-lamp",
  appliance: "blender",
  fridge: "refrigerator",
  freezer: "refrigerator",
  cooker: "oven",
  stove: "oven",
  hob: "oven",
  washer: "washing-machine",
  "washing-machine": "washing-machine",
  dryer: "washing-machine",
  "tumble-dryer": "washing-machine",
  kettle: "electric-kettle",
  vacuum: "vacuum-cleaner",
  hoover: "vacuum-cleaner",
  camera: "digital-camera",
  cctv: "digital-camera",
  lock: "padlock",
  "door-lock": "padlock",
  car: "sedan-car",
  vehicle: "sedan-car",
  van: "delivery-van",
  bike: "bicycle",
  cycle: "bicycle",
  mower: "lawn-mower",
  router: "wifi-router",
  modem: "wifi-router",
  wifi: "wifi-router",
  computer: "desktop-computer",
  pc: "desktop-computer",
  monitor: "computer-monitor",
  mouse: "computer-mouse",
  tv: "television",
  television: "television",
  sofa: "chesterfield-sofa",
  couch: "chesterfield-sofa",
  table: "dining-table",
  chair: "office-chair",
  desk: "home-office-desk",
  wardrobe: "antique-armoire",
  armoire: "antique-armoire",
  extinguisher: "padlock",
  "fire-extinguisher": "padlock",
  alarm: "padlock",
  "smoke-alarm": "padlock",
  detector: "padlock",
  grill: "barbecue-grill",
  bbq: "barbecue-grill",
  toolbox: "toolbox",
  tools: "metal-toolbox",
  drill: "cordless-power-drill",
  hammer: "claw-hammer",
  wrench: "adjustable-wrench",
  pliers: "combination-pliers",
};

type KeywordRule = { pattern: RegExp; slug: string };

const KEYWORD_ILLUSTRATION_RULES: KeywordRule[] = [
  { pattern: /\b(air.?cond|a\/?c|hvac|heat.?pump|chiller)\b/i, slug: "air-conditioner" },
  { pattern: /\b(boiler|furnace|radiator|heater|thermostat)\b/i, slug: "radiator" },
  { pattern: /\b(dishwasher)\b/i, slug: "dishwasher" },
  { pattern: /\b(washing.?machine|washer|tumble.?dryer|dryer)\b/i, slug: "washing-machine" },
  { pattern: /\b(fridge|refrigerator|freezer)\b/i, slug: "refrigerator" },
  { pattern: /\b(oven|cooker|stove|hob)\b/i, slug: "oven" },
  { pattern: /\b(microwave)\b/i, slug: "microwave" },
  { pattern: /\b(toaster)\b/i, slug: "toaster" },
  { pattern: /\b(kettle)\b/i, slug: "electric-kettle" },
  { pattern: /\b(blender|mixer)\b/i, slug: "blender" },
  { pattern: /\b(vacuum|hoover)\b/i, slug: "vacuum-cleaner" },
  { pattern: /\b(toilet|wc|loo)\b/i, slug: "toilet" },
  { pattern: /\b(shower)\b/i, slug: "shower" },
  { pattern: /\b(sink|tap|faucet|basin)\b/i, slug: "bathroom-sink" },
  { pattern: /\b(bed)\b/i, slug: "bed" },
  { pattern: /\b(sofa|couch|chesterfield)\b/i, slug: "chesterfield-sofa" },
  { pattern: /\b(laptop|notebook)\b/i, slug: "laptop" },
  { pattern: /\b(printer)\b/i, slug: "printer" },
  { pattern: /\b(camera|cctv)\b/i, slug: "digital-camera" },
  { pattern: /\b(lock|padlock)\b/i, slug: "padlock" },
  { pattern: /\b(bicycle|bike|cycle)\b/i, slug: "bicycle" },
  { pattern: /\b(van)\b/i, slug: "delivery-van" },
  { pattern: /\b(car|vehicle|sedan)\b/i, slug: "sedan-car" },
  { pattern: /\b(mower|lawn)\b/i, slug: "lawn-mower" },
  { pattern: /\b(router|wifi|modem)\b/i, slug: "wifi-router" },
  { pattern: /\b(fan|ventilat)\b/i, slug: "desk-fan" },
  { pattern: /\b(lamp|light)\b/i, slug: "desk-lamp" },
  { pattern: /\b(extinguisher|smoke|detector|alarm)\b/i, slug: "padlock" },
  { pattern: /\b(drill)\b/i, slug: "cordless-power-drill" },
  { pattern: /\b(hammer)\b/i, slug: "claw-hammer" },
  { pattern: /\b(wrench|spanner)\b/i, slug: "adjustable-wrench" },
  { pattern: /\b(toolbox|tools)\b/i, slug: "toolbox" },
  { pattern: /\b(grill|bbq|barbecue)\b/i, slug: "barbecue-grill" },
  { pattern: /\b(monitor|screen)\b/i, slug: "computer-monitor" },
  { pattern: /\b(desktop|computer|pc)\b/i, slug: "desktop-computer" },
];

export function assetIllustrationSlug(name: string | null | undefined): string {
  if (!name?.trim()) return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function illustrationForSlug(slug: string): string | undefined {
  if (!slug) return undefined;
  const targetSlug = ASSET_MINI_CARD_SLUG_ALIAS[slug] ?? slug;
  if (ASSET_MINI_CARD_ILLUSTRATION[targetSlug]) return ASSET_MINI_CARD_ILLUSTRATION[targetSlug];
  const base = targetSlug.replace(/-\d+$/, "");
  const aliasedBase = ASSET_MINI_CARD_SLUG_ALIAS[base] ?? base;
  return ASSET_MINI_CARD_ILLUSTRATION[aliasedBase] ?? ASSET_MINI_CARD_ILLUSTRATION[base];
}

function labelSimilarity(a: string, b: string): number {
  const na = normalizeString(a);
  const nb = normalizeString(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const longer = Math.max(na.length, nb.length);
  return 1 - levenshteinDistance(na, nb) / longer;
}

function illustrationFromKeywords(label: string): string | undefined {
  const text = label.trim().toLowerCase();
  if (!text) return undefined;
  for (const rule of KEYWORD_ILLUSTRATION_RULES) {
    if (rule.pattern.test(text)) {
      return ASSET_MINI_CARD_ILLUSTRATION[rule.slug];
    }
  }
  return undefined;
}

function fuzzyCatalogMatch(query: string): string | undefined {
  const queryWords = normalizeString(query).split(/\s+/).filter(Boolean);
  let bestScore = 0.55;
  let bestSlug: string | undefined;
  for (const slug of Object.keys(ASSET_MINI_CARD_ILLUSTRATION)) {
    const label = slug.replace(/-/g, " ");
    const overlap = queryWords.filter((w) => label.includes(w)).length;
    const score = labelSimilarity(query, label) + overlap * 0.06;
    if (score > bestScore) {
      bestScore = score;
      bestSlug = slug;
    }
  }
  return bestSlug ? ASSET_MINI_CARD_ILLUSTRATION[bestSlug] : undefined;
}

/**
 * Pick the best mini-card thumbnail for an asset label / type.
 * Exact / alias → keywords → fuzzy catalog match.
 */
export function getAssetMiniCardIllustration(
  name: string | null | undefined,
  assetType?: string | null
): string | undefined {
  const raw = name?.trim() || assetType?.trim();
  if (!raw) return undefined;

  const exact =
    illustrationForSlug(assetIllustrationSlug(raw)) ??
    (assetType ? illustrationForSlug(assetIllustrationSlug(assetType)) : undefined);
  if (exact) return exact;

  const fromKeywords =
    illustrationFromKeywords(raw) ??
    (assetType ? illustrationFromKeywords(assetType) : undefined);
  if (fromKeywords) return fromKeywords;

  return fuzzyCatalogMatch(raw) ?? (assetType ? fuzzyCatalogMatch(assetType) : undefined);
}

/** Resolved mini-card path, or toolbox fallback when nothing matches. */
export function resolveAssetMiniCardIllustration(
  name: string | null | undefined,
  assetType?: string | null
): string {
  return getAssetMiniCardIllustration(name, assetType) ?? NEUTRAL_FALLBACK;
}

export type AssetMiniCardOption = {
  slug: string;
  src: string;
  label: string;
};

/** Catalog of pickable asset mini-card thumbnails. */
export function listAssetMiniCardIllustrations(): AssetMiniCardOption[] {
  return Object.entries(ASSET_MINI_CARD_ILLUSTRATION)
    .map(([slug, src]) => ({
      slug,
      src,
      label: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
