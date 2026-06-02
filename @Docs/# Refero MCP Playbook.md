# Refero MCP Playbook

Refero gives agents taste and product evidence. Use it before design work instead of
relying on generic model knowledge.

Strongly recommended companion: use this MCP together with the Refero Design skill.
The MCP provides live research tools; the skill provides the deeper design methodology,
craft rules, anti-AI-slop guidance, and quality gates.

Install the skill in agents that support skills:

```bash
npx skills add https://github.com/referodesign/refero_skill --skill refero-design
```

When the Refero Design skill is available, use it as the design methodology. Do not use
generic frontend/product design skills as a parallel design authority; they can conflict
with the reference-grounded workflow and push the result toward generic AI design.

Refero has three research layers:

1. Styles - visual direction and taste.
2. Screens - concrete UI patterns and product-screen decisions.
3. Flows - multi-step journey logic.

The best output usually combines these layers:
visual direction from styles, concrete UI patterns from screens, and sequencing from
flows when the task has multiple steps.

---

## Tool Routing

### Use styles first for visual work

Use `refero_search_styles` when the user asks to design, redesign, improve, polish, or
create anything with a visual component.

A style is a semantic design reference extracted from a real web marketing/product page.
Search results give a preview: UUID, title, source URL, preview image URL, and a rich
description of the visual language. Full style references from `refero_get_style` give
tokens, typography, layout/composition, section rhythm, spacing, elevation, components,
imagery guidance, implementation notes, and do/don't rules.
They may also include image strategy, illustration systems, product screenshot treatment,
graphics, and other media roles. Preserve those roles: use capable assets when available,
or intentional placeholders with aspect ratio and art direction when the asset is
unavailable.

Styles are best for:
- look and feel
- brand direction
- landing pages and marketing pages
- typography
- color palette
- layout and composition
- section structure and rhythm
- spacing density and elevation
- surfaces, cards, buttons, shadows, radius
- component examples and implementation/code notes when present
- imagery, graphics, illustration, or product screenshot treatment
- media asset strategy
- design-system inspiration
- making a generic interface feel more tasteful

Current limitation: styles currently cover web marketing/product pages, not in-app
dashboards, auth screens, settings screens, or iOS app screens. Still use styles for
product UI tasks to establish visual language, then use screens/flows for product logic.

### Use screens for concrete UI patterns

Use `refero_search_screens` when you need:
- a specific screen type
- a specific component or UI pattern
- page layout
- content hierarchy
- copy and CTA patterns
- form/state examples
- dashboard, settings, modal, table, pricing, empty state, auth, or product-screen details

After finding strong screens:
- use `refero_get_screen` for full details
- use `refero_get_similar_screens` to expand from a strong example
- use `refero_get_screen_image` when raw image inspection is needed

### Use flows for journeys

Use `refero_search_flows` when the task has a before and after:
- onboarding
- signup
- checkout
- subscription management
- cancellation
- account deletion
- password reset
- profile/settings changes
- any multi-step process

After finding a strong flow, use `refero_get_flow` for step-by-step goals, actions,
system responses, and completion states.

---

## Core Workflow

### 0. Clarify the task

Identify:
- what is being designed
- platform: web or iOS
- audience
- primary user goal
- desired feeling
- constraints
- whether the task needs visual direction, concrete UI patterns, journey logic, or all three

Do not ask unnecessary questions if context is enough. Make reasonable assumptions and
start researching.

### 1. Research visual direction with styles

For any visual design task, start with styles.

Do not copy one style directly. Search multiple directions and synthesize a unique style
for the user's product.

Recommended style loop:
1. Search 3-5 different visual angles.
2. Include one broad aesthetic query.
3. Include one domain/category query.
4. Include one known-brand or strong-product query when relevant.
5. Retrieve 3-4 strong styles with `refero_get_style`; full styles average 10-15k chars each, so split larger research into multiple batches.
6. Compare what each style contributes.
7. Choose one primary foundation and borrow 1-2 specific details from other styles.
8. Create a reference lock before implementation: primary direction, traits to preserve,
   borrowed details, source token/component role rules, explicit rejects, and token commitments.

Good style queries:
- editorial monochrome SaaS landing page
- warm trustworthy healthcare product marketing
- premium fintech website with restrained typography
- playful creator tool landing page with vivid accents
- developer tool website with product screenshots
- luxury ecommerce editorial product page
- productivity SaaS with airy spacing
- data infrastructure website dark technical style
- Attio editorial SaaS typography
- Linear changelog dark developer tool
- shadcn monochrome design system

Extract from styles:
- north star / visual thesis
- typography personality and type scale
- color roles and accent discipline
- spacing density and rhythm
- layout system, section rhythm, and composition patterns
- card/button/surface treatments
- borders, shadows, radius
- elevation and depth rules
- component examples and implementation/code notes when present
- imagery, graphics, illustration, or product screenshot treatment
- media asset strategy: real/generated/stock/code-native asset, product screenshot, or placeholder
- do/don't rules
- one memorable visual move to adapt

Synthesis rule:
- Primary style: overall mood, density, and structure.
- Secondary styles: specific borrowed details.
- User context: adapt everything to the product, audience, and task.
- Do not use the average/intersection of all references. If one reference is dark, one is
  acid, and one is serif, the answer is not warm cream + muted orange + polite serif.
- Do not default to decorative headline word swaps: one word or short phrase set in a
  different display/serif/script/italic style or accent color unless the primary style
  and content role explicitly justify that treatment.
- Do not change token meanings. CTA-only colors, code-only syntax colors, decorative
  gradients, and component-state treatments must stay in those roles or be omitted.
- Do not collapse image-led references into text-only layouts. If you cannot produce the
  required image or graphic, keep a stable placeholder with art direction instead of
  faking complex imagery with weak CSS or generic decoration.

Never present the result as "copying X". Present it as a new direction inspired by
several references.

### 2. Research screens for concrete UI decisions

Use screens when you need to know what the interface should contain or how real products
solve a specific UI problem.

Good screen queries:
- pricing page annual monthly toggle
- feature comparison table
- dashboard empty state
- billing settings cancellation modal
- onboarding progress indicator
- 2FA setup recovery codes
- data table filters
- destructive action confirmation

Search by facts on the screen:
- page type
- component
- state
- company/product
- on-screen text

Avoid using screens as the primary style source when the task is visual. Use styles first,
then screens for structure and details.

After search:
- call `refero_get_screen` for the strongest examples
- call `refero_get_similar_screens` when one screen is especially relevant
- compare multiple approaches instead of trusting the first result

Extract from screens:
- layout structure
- information hierarchy
- component choices
- CTA patterns
- content/copy patterns
- states and edge cases
- trust or conversion tactics
- concrete details worth adapting

### 3. Research flows for journey logic

Use flows when there are multiple steps or a user changes state over time.

Good flow queries:
- signup onboarding
- checkout with promo code
- subscription cancellation
- account deletion feedback
- password reset 2FA
- workspace billing upgrade

If flow search is sparse, broaden the query. If still sparse, use screens and reconstruct
the journey.

Extract from flows:
- entry point
- exit state
- step count
- decisions the user makes
- friction reducers
- required confirmations
- save/recovery states
- error handling
- retention or persuasion moments
- system response at each step

---

## Research Depth

Match depth to task risk.

For a quick visual improvement:
- 2-3 style searches
- 2-3 full styles
- 1 short synthesis

For a new landing page, brand direction, or major redesign:
- 3-5 style searches
- 3-4 full styles in one batch; use additional batches only when needed
- screen research for concrete sections/components
- clear visual direction before implementation

For a product workflow:
- styles for visual language
- screens for key states/components
- flows for sequencing

For high-stakes or ambiguous tasks:
- search from several angles
- inspect later pages
- compare strong and unusual references
- document tradeoffs before designing

---

## Analysis Framework

Separate findings into three buckets.

### Visual Direction

From styles:
- mood
- typography
- palette
- layout and composition
- density
- surfaces
- spacing/elevation
- component/code notes when present
- imagery and media asset strategy
- distinctive details
- do/don't rules
- reference lock: traits to preserve, details to borrow, token/media roles to keep, defaults to reject

Output example:
"Use a data-infrastructure foundation: precise grid, compact sans UI, restrained neutral
canvas, thin borders, and product screenshots as evidence. Borrow tighter type hierarchy
from an editorial reference, but reject cream editorial canvas, serif hero type, and
muted clay/orange accents. Do not add decorative word-swap treatment unless the reference
and content role require it."

### Product Pattern

From screens:
- what the interface needs to contain
- common layouts
- component patterns
- states
- copy and CTAs
- specific tactics

Output example:
"Pricing pages commonly put billing toggle above plan cards, highlight one plan, and
move detailed feature comparison below. Arcade uses four cards plus a full feature
table; FlowMapp keeps the hero simpler with a prominent trial CTA."

### Journey Logic

From flows:
- steps
- decision points
- system responses
- user confidence and friction
- success/failure states

Output example:
"Cancellation flows usually intercept with an offer, collect a reason, confirm the
destructive action, then update subscription status. The best flows state when access
ends and offer an undo or renewal path."

---

## Do Not Copy

References are ingredients, not templates.

Bad:
- use one style exactly
- copy another brand's palette, typography, layout, and component treatment as a bundle
- search one obvious query and stop
- average all references into a generic result

Good:
- compare several strong styles
- choose one foundation
- borrow a small number of specific details
- adapt to the user's product and audience
- create a style that could belong uniquely to this product

Ask:
- What should this product be remembered for?
- Which reference gives us the right mood?
- Which reference gives us the best detail?
- What should we avoid so the result does not look generic?

---

## Presenting Findings

Keep the user's goal in focus. Do not dump every result.

A useful research summary includes:
- what was searched
- which styles/screens/flows mattered
- what patterns emerged
- what stood out
- what direction you recommend
- why that direction fits this user/product

Suggested format:

```text
Research summary:
- Styles reviewed: [count] across [directions]
- Screens reviewed: [count], if used
- Flows reviewed: [count], if used

Visual direction:
- [primary style foundation]
- [borrowed detail 1]
- [borrowed detail 2]

Product patterns:
- [concrete UI decisions from screens]

Journey logic:
- [flow decisions, if applicable]

Recommendation:
- [what to design and why]
```

---

## Quality Check Before Designing

Before implementing, confirm:
- Did I use styles for visual taste?
- Did I avoid copying one style directly?
- Did I synthesize multiple references into a unique direction?
- Did I preserve source token, component, and media roles?
- Did I use screens when concrete UI patterns were needed?
- Did I use flows when the task had multiple steps?
- Can I explain which references influenced the design and why?

If the answer is no, research more before designing.
