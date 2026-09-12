// Clause library — foundation, not a giant library (Phase 28).
//
// Minimal, extensible, code-owned. No DB, no giant prompts. Each clause is
// a drafting suggestion, not statutory text. The UI must label it as such.
// Variables that are missing remain UNKNOWN / NEEDS INPUT, never invented.

export type ClauseCategory =
  | "ownership"
  | "vesting"
  | "governance"
  | "transfer"
  | "leaver"
  | "ip"
  | "dilution"
  | "liability"
  | "contribution"
  | "profit"
  | "authority"
  | "exit"
  | "dissolution"
  | "confidentiality"
  | "structure"
  | "roles"
  | "payment"
  | "subject"
  | "delivery"
  | "warranty"
  | "term"
  | "termination"
  | "maintenance"
  | "compensation"

export interface ClauseVariable {
  key: string // e.g. "founder_names", "vesting_period"
  label: string
  required: boolean
  placeholder: string // shown when unknown
}

export type ClauseDealType = "founder" | "partnership" | "purchase_sale" | "lease" | "employment"

export interface ClauseTemplate {
  id: string
  dealTypes: ClauseDealType[]
  protectionCategories: ClauseCategory[]
  title: string
  purpose: string
  variables: ClauseVariable[]
  template: string // mustache-like {{var}} placeholders; never law
  warnings: string[] // e.g. "This is drafting assistance, not a determination of enforceability."
  legalContextIds: string[] // ids into INTERNATIONAL_LEGAL_CORPUS for citation; filtered by jurisdiction at render
  version: number
}

const FOUNDER_CLAUSES: ClauseTemplate[] = [
  {
    id: "founder-ownership-allocation",
    dealTypes: ["founder"],
    protectionCategories: ["ownership"],
    title: "Ownership allocation",
    purpose: "Records each founder's percentage so the cap table is explicit.",
    variables: [
      { key: "founder_names", label: "Founder names", required: true, placeholder: "[Founder A], [Founder B]" },
      { key: "ownership_percentages", label: "Ownership percentages", required: true, placeholder: "[e.g. 60/40]" },
      { key: "company_name", label: "Company name", required: true, placeholder: "[Company Name]" },
    ],
    template: "The founders agree that the issued share capital of {{company_name}} shall be held as follows: {{founder_names}} in the proportions {{ownership_percentages}}, as reflected in the register of members. No further shares shall be issued without prior written consent of founders holding a majority of the issued shares (see governance).",
    warnings: ["This is drafting assistance, not a determination of enforceability. Confirm that the allocation is reflected in the articles, register of members, and CAC returns (CAMA 2020 Section 18)."],
    legalContextIds: ["ng-cama-s18-types-of-companies"],
    version: 1,
  },
  {
    id: "founder-vesting-schedule",
    dealTypes: ["founder"],
    protectionCategories: ["vesting"],
    title: "Vesting schedule with cliff",
    purpose: "Prevents a departing founder from retaining unearned equity.",
    variables: [
      { key: "vesting_period", label: "Vesting period", required: true, placeholder: "[4 years]" },
      { key: "cliff", label: "Cliff", required: true, placeholder: "[12 months]" },
      { key: "acceleration", label: "Acceleration", required: false, placeholder: "[none / single-trigger / double-trigger]" },
    ],
    template: "Each founder's shares shall vest over {{vesting_period}} with a {{cliff}} cliff. No shares vest before the cliff. On termination, unvested shares are forfeited or repurchased at nominal value. {{acceleration}} acceleration, if any, applies only as expressly stated. This vesting is contractual under Nigerian law (no statutory vesting schedule under CAMA).",
    warnings: ["Vesting is contractual in Nigeria; confirm the schedule, cliff, good/bad leaver definitions, and repurchase price."],
    legalContextIds: ["ng-cama-vesting-contractual"],
    version: 1,
  },
  {
    id: "founder-ip-assignment",
    dealTypes: ["founder"],
    protectionCategories: ["ip"],
    title: "IP assignment to the company",
    purpose: "Ensures work created by founders belongs to the company.",
    variables: [
      { key: "company_name", label: "Company name", required: true, placeholder: "[Company Name]" },
      { key: "ip_scope", label: "IP scope", required: true, placeholder: "[all inventions, works, and IP created for the company]" },
    ],
    template: "Each founder hereby assigns to {{company_name}} all rights in {{ip_scope}} created by the founder in connection with the company's business, and agrees to execute further documents to perfect that assignment. Pre-existing IP remains with the founder and is licensed only as separately agreed.",
    warnings: ["Confirm the company's objects permit the assignment (CAMA 2020 Section 22)."],
    legalContextIds: ["ng-cama-s22-capacity"],
    version: 1,
  },
  {
    id: "founder-governance-reserved-matters",
    dealTypes: ["founder"],
    protectionCategories: ["governance"],
    title: "Governance — reserved matters and deadlock",
    purpose: "Prevents deadlocks by defining how decisions are made.",
    variables: [
      { key: "governance_thresholds", label: "Governance thresholds", required: true, placeholder: "[e.g. majority of directors, 75% of shareholders]" },
      { key: "reserved_matters", label: "Reserved matters", required: true, placeholder: "[e.g. share issuance, borrowing >₦X, IP assignment]" },
      { key: "deadlock_mechanism", label: "Deadlock mechanism", required: false, placeholder: "[e.g. mediation, then buy-sell]" },
    ],
    template: "Day-to-day management is delegated as agreed, but the following reserved matters require {{governance_thresholds}}: {{reserved_matters}}. If the board is deadlocked for 14 days, the founders shall first seek mediation; if unresolved, {{deadlock_mechanism}} applies. Founders who are directors remain subject to directors' duties (CAMA 2020 Section 305).",
    warnings: ["Founders who are directors owe fiduciary duties; record how conflicts are handled."],
    legalContextIds: ["ng-cama-s240-directors-duties"],
    version: 1,
  },
  {
    id: "founder-leaver-buyout",
    dealTypes: ["founder"],
    protectionCategories: ["leaver"],
    title: "Good/bad leaver and buyout",
    purpose: "Defines what happens to shares when a founder leaves.",
    variables: [
      { key: "leaver_definitions", label: "Leaver definitions", required: true, placeholder: "[good leaver: death/disability/termination without cause; bad leaver: other]" },
      { key: "buyout_price", label: "Buyout price/mechanics", required: true, placeholder: "[e.g. fair market value for good leaver, nominal for bad leaver]" },
    ],
    template: "If a founder departs, the leaver is classified as {{leaver_definitions}}. The company or remaining founders may repurchase the leaver's shares at {{buyout_price}}, within 30 days of departure. Vesting continues to apply.",
    warnings: ["Leaver provisions are contractual; define good/bad leaver and price clearly."],
    legalContextIds: ["ng-cama-vesting-contractual"],
    version: 1,
  },
  {
    id: "founder-transfer-restriction",
    dealTypes: ["founder"],
    protectionCategories: ["transfer"],
    title: "Share transfer restriction (ROFR/board consent)",
    purpose: "Prevents an unwanted third party from acquiring shares.",
    variables: [
      { key: "transfer_consent", label: "Transfer consent", required: true, placeholder: "[e.g. prior written consent of founders holding majority]" },
    ],
    template: "No founder may transfer shares without {{transfer_consent}}. Any purported transfer in breach is void. Transfers are subject to the articles and CAMA 2020 Section 140; restrictions not in the articles may be unenforceable against the company.",
    warnings: ["Put transfer restrictions in the articles to bind the company (CAMA 2020 Section 140)."],
    legalContextIds: ["ng-cama-s140-transfer-of-shares"],
    version: 1,
  },
  {
    id: "founder-liability-limitation",
    dealTypes: ["founder"],
    protectionCategories: ["liability"],
    title: "Liability allocation",
    purpose: "Caps and allocates founder liability where appropriate.",
    variables: [
      { key: "liability_cap", label: "Liability cap", required: true, placeholder: "[e.g. amount of capital contributed / fees paid]" },
    ],
    template: "Except for fraud or wilful misconduct, each founder's aggregate liability under this agreement shall not exceed {{liability_cap}}. Founders remain liable for their own negligence and for breach of IP or confidentiality obligations as separately defined.",
    warnings: ["Liability allocation depends on facts; do not overstate enforceability."],
    legalContextIds: ["ng-cama-s240-directors-duties"],
    version: 1,
  },
  {
    id: "founder-dilution-protection",
    dealTypes: ["founder"],
    protectionCategories: ["dilution"],
    title: "Dilution and future issuances",
    purpose: "Makes future share issues predictable.",
    variables: [
      { key: "dilution_mechanism", label: "Dilution mechanism", required: false, placeholder: "[e.g. pro-rata rights, anti-dilution: none/weighted-average]" },
    ],
    template: "Future share issuances require consent as per reserved matters. {{dilution_mechanism}} If no anti-dilution is agreed, state that expressly so founders understand they will be diluted pro-rata on new issuances.",
    warnings: ["Future issuances affect the cap table; record the agreed treatment."],
    legalContextIds: ["ng-cama-s18-types-of-companies", "ng-cama-s53-share-capital"],
    version: 1,
  },
]

const PARTNERSHIP_CLAUSES: ClauseTemplate[] = [
  {
    id: "partnership-contributions-schedule",
    dealTypes: ["partnership"],
    protectionCategories: ["contribution"],
    title: "Capital contributions",
    purpose: "Records what each partner puts in and when.",
    variables: [
      { key: "partner_names", label: "Partner names", required: true, placeholder: "[Partner A], [Partner B]" },
      { key: "contribution_amounts", label: "Contribution amounts", required: true, placeholder: "[e.g. ₦1,000,000 each]" },
      { key: "contribution_timing", label: "Contribution timing", required: true, placeholder: "[e.g. on execution / within 7 days]" },
    ],
    template: "The partners shall contribute as follows: {{partner_names}} shall each contribute {{contribution_amounts}} {{contribution_timing}}. Additional contributions require unanimous consent. In an LLP, contributions are as per the LLP agreement (CAMA 2020 Section 744) and, absent agreement, the First Schedule applies.",
    warnings: ["State whether further contributions (capital calls) may be required."],
    legalContextIds: ["ng-partnership-contributions", "ng-cama-s744-llp-agreement"],
    version: 1,
  },
  {
    id: "partnership-profit-allocation",
    dealTypes: ["partnership"],
    protectionCategories: ["profit", "ownership"],
    title: "Profit and loss allocation",
    purpose: "Avoids disputes over how money is split.",
    variables: [
      { key: "profit_percentages", label: "Profit percentages", required: true, placeholder: "[e.g. 50/50]" },
      { key: "distribution_timing", label: "Distribution timing", required: true, placeholder: "[e.g. quarterly, within 15 days of quarter end]" },
    ],
    template: "Profits and losses shall be allocated {{profit_percentages}} and distributed {{distribution_timing}}. Unless otherwise agreed, the default under partnership principles and the LLP First Schedule is equal sharing — this agreement displaces that default.",
    warnings: ["If you do not state otherwise, profits are shared equally by default."],
    legalContextIds: ["ng-partnership-contributions"],
    version: 1,
  },
  {
    id: "partnership-authority-management",
    dealTypes: ["partnership"],
    protectionCategories: ["authority"],
    title: "Authority to bind and management",
    purpose: "Prevents a partner from binding the firm unexpectedly.",
    variables: [
      { key: "managing_partner", label: "Managing partner", required: true, placeholder: "[Partner A as managing partner]" },
      { key: "authority_to_bind", label: "Authority to bind", required: true, placeholder: "[e.g. managing partner may bind up to ₦X; other partners require consent]" },
    ],
    template: "{{managing_partner}} shall manage day-to-day affairs. {{authority_to_bind}}. Any partner acting outside authority is personally responsible and must indemnify the firm. For LLPs, authority is as per the LLP agreement (CAMA 2020 Section 744).",
    warnings: ["Clarify who can sign contracts, borrow, or dispose of assets."],
    legalContextIds: ["ng-cama-s744-llp-agreement"],
    version: 1,
  },
  {
    id: "partnership-governance-deadlock",
    dealTypes: ["partnership"],
    protectionCategories: ["governance"],
    title: "Governance and deadlock",
    purpose: "Defines how the partnership decides and what happens if it deadlocks.",
    variables: [
      { key: "voting_thresholds", label: "Voting thresholds", required: true, placeholder: "[e.g. majority of capital, unanimous for admission of new partner]" },
      { key: "reserved_matters", label: "Reserved matters", required: true, placeholder: "[e.g. borrowing >₦X, admitting partner, amending agreement]" },
      { key: "deadlock_mechanism", label: "Deadlock mechanism", required: false, placeholder: "[e.g. mediation, then buy-sell]" },
    ],
    template: "Decisions require {{voting_thresholds}}. Reserved matters ({{reserved_matters}}) require unanimous consent. If deadlocked for 14 days, the partners shall mediate; if unresolved, {{deadlock_mechanism}} applies.",
    warnings: ["For LLPs, governance defaults to the First Schedule absent an agreement."],
    legalContextIds: ["ng-cama-s744-llp-agreement"],
    version: 1,
  },
  {
    id: "partnership-transfer-restriction",
    dealTypes: ["partnership"],
    protectionCategories: ["transfer", "structure"],
    title: "Transfer of partnership interest",
    purpose: "Controls who can become a partner.",
    variables: [
      { key: "transfer_consent", label: "Transfer consent", required: true, placeholder: "[e.g. unanimous consent of remaining partners]" },
    ],
    template: "No partner may transfer its interest without {{transfer_consent}}. An assignee does not become a partner without consent and admission. For an ordinary partnership, transfer without consent may dissolve the partnership; for an LLP, admission is as per the LLP agreement and the Act.",
    warnings: ["Do not collapse LLPs, LPs, and ordinary partnerships. State the structure explicitly; if UNKNOWN, ask rather than guess."],
    legalContextIds: ["ng-cama-part3-llp-nature"],
    version: 1,
  },
  {
    id: "partnership-exit-dissolution",
    dealTypes: ["partnership"],
    protectionCategories: ["exit", "dissolution"],
    title: "Exit, buyout, and dissolution",
    purpose: "Makes departure and winding-up predictable.",
    variables: [
      { key: "exit_valuation", label: "Exit valuation method", required: true, placeholder: "[e.g. independent valuation, book value, fair market value]" },
      { key: "dissolution_triggers", label: "Dissolution triggers", required: true, placeholder: "[e.g. unanimous resolution, death, insolvency, term expiry]" },
    ],
    template: "A departing partner's interest is valued by {{exit_valuation}} and paid within 30 days. The partnership dissolves on {{dissolution_triggers}}, after which winding-up and distribution follow the agreement and applicable law. An LLP remains a body corporate until dissolved under the Act (CAMA 2020 Part C).",
    warnings: ["For LLPs, dissolution is under the Act; for ordinary partnerships, departure may dissolve the firm."],
    legalContextIds: ["ng-cama-part3-llp-nature"],
    version: 1,
  },
  {
    id: "partnership-ip-confidentiality",
    dealTypes: ["partnership"],
    protectionCategories: ["ip", "confidentiality"],
    title: "IP and confidentiality",
    purpose: "Clarifies who owns work and what must stay confidential.",
    variables: [
      { key: "ip_owner", label: "IP owner", required: true, placeholder: "[e.g. the partnership/LLP]" },
      { key: "confidentiality_scope", label: "Confidentiality scope", required: true, placeholder: "[e.g. business information, customer lists, pricing]" },
    ],
    template: "IP created for the partnership belongs to {{ip_owner}} and each partner assigns rights accordingly. {{confidentiality_scope}} is confidential and may not be disclosed except as required by law or with consent. The partnership's objects should permit the assignment (CAMA 2020).",
    warnings: ["State IP ownership expressly; in an LLP, IP of the LLP is distinct from partners'."],
    legalContextIds: ["ng-cama-s22-capacity"],
    version: 1,
  },
  {
    id: "partnership-liability-allocation",
    dealTypes: ["partnership"],
    protectionCategories: ["liability"],
    title: "Liability and indemnity",
    purpose: "Allocates liability appropriately for the chosen structure.",
    variables: [
      { key: "liability_allocation", label: "Liability allocation", required: true, placeholder: "[e.g. LLP: partners not personally liable beyond contributions; partnership: jointly and severally liable]" },
    ],
    template: "Liability is {{liability_allocation}}. In an LLP, partners have limited liability as per the Act; in an ordinary partnership, partners are jointly and severally liable. Indemnities are as separately defined and do not displace statutory liability. If the structure is UNKNOWN, do not assume LLP protections apply.",
    warnings: ["Do not assume LLP limited liability for an ordinary partnership. If structure is UNKNOWN, ask."],
    legalContextIds: ["ng-cama-part3-llp-nature"],
    version: 1,
  },
]

const PURCHASE_SALE_CLAUSES: ClauseTemplate[] = [
  {
    id: "purchase-price-payment-terms",
    dealTypes: ["purchase_sale"],
    protectionCategories: ["payment"],
    title: "Purchase price and payment terms",
    purpose: "States the exact price, currency, and when it is paid.",
    variables: [
      { key: "purchase_price", label: "Purchase price", required: true, placeholder: "[e.g. 50,000]" },
      { key: "currency", label: "Currency", required: true, placeholder: "[e.g. USD]" },
      { key: "payment_timing", label: "Payment timing", required: true, placeholder: "[e.g. on completion / in two instalments]" },
    ],
    template: "The purchase price is {{purchase_price}} {{currency}}, payable {{payment_timing}}. The price includes the asset as described and excludes taxes, fees, and delivery costs unless expressly stated. No part of the price is refundable except as expressly provided in the termination terms.",
    warnings: ["This is drafting assistance, not a determination of enforceability. Confirm what the price includes and which taxes or fees apply in your jurisdiction."],
    legalContextIds: ["us-ucc-article2-sale", "uk-sale-goods-1979", "eu-sale-goods-directive-2019-771", "de-bgb-contracts", "fr-code-civil-contracts", "nl-bw-contracts"],
    version: 1,
  },
  {
    id: "purchase-inspection-acceptance",
    dealTypes: ["purchase_sale"],
    protectionCategories: ["warranty"],
    title: "Inspection, acceptance, and warranty",
    purpose: "Gives the buyer a window to inspect and a basis for warranty claims.",
    variables: [
      { key: "inspection_window", label: "Inspection window", required: true, placeholder: "[e.g. 14 days after delivery]" },
      { key: "warranty_scope", label: "Warranty scope", required: true, placeholder: "[e.g. free of defects, fit for stated purpose]" },
    ],
    template: "The buyer may inspect the asset within {{inspection_window}} after delivery and may reject non-conforming goods within that window. The seller warrants that the asset is {{warranty_scope}}. Implied warranties under applicable sale-of-goods law apply unless lawfully and expressly excluded.",
    warnings: ["This is drafting assistance, not a determination of enforceability. Some jurisdictions constrain warranty exclusions; an inspection right does not replace them."],
    legalContextIds: ["us-ucc-article2-sale", "uk-sale-goods-1979", "eu-sale-goods-directive-2019-771", "de-bgb-contracts", "fr-code-civil-contracts", "nl-bw-contracts"],
    version: 1,
  },
  {
    id: "purchase-title-transfer",
    dealTypes: ["purchase_sale"],
    protectionCategories: ["transfer"],
    title: "Title transfer and risk of loss",
    purpose: "States when ownership and risk pass from seller to buyer.",
    variables: [
      { key: "title_trigger", label: "Title transfer trigger", required: true, placeholder: "[e.g. on full payment / on delivery]" },
    ],
    template: "Title to the asset transfers {{title_trigger}}. Risk of loss passes with title unless expressly stated otherwise. The seller shall deliver the asset free of liens and encumbrances at transfer.",
    warnings: ["This is drafting assistance, not a determination of enforceability. Retention-of-title and lien rules vary by jurisdiction."],
    legalContextIds: ["us-ucc-article2-sale", "uk-sale-goods-1979", "eu-sale-goods-directive-2019-771", "de-bgb-contracts", "fr-code-civil-contracts", "nl-bw-contracts"],
    version: 1,
  },
]

const LEASE_CLAUSES: ClauseTemplate[] = [
  {
    id: "lease-rent-deposit",
    dealTypes: ["lease"],
    protectionCategories: ["payment"],
    title: "Rent and deposit",
    purpose: "States the rent, when it is due, and how the deposit works.",
    variables: [
      { key: "rent_amount", label: "Rent amount", required: true, placeholder: "[e.g. 2,000 per month]" },
      { key: "payment_frequency", label: "Payment frequency", required: true, placeholder: "[e.g. monthly in advance]" },
      { key: "deposit_amount", label: "Deposit amount", required: true, placeholder: "[e.g. one month rent]" },
    ],
    template: "The rent is {{rent_amount}}, payable {{payment_frequency}}. A deposit of {{deposit_amount}} is held as security and returned within the statutory period after the lease ends, less lawful deductions for arrears or damage beyond fair wear. Rent increases, if any, require the agreed notice and mechanism.",
    warnings: ["This is drafting assistance, not a determination of enforceability. Deposit caps, return periods, and increase rules are jurisdiction-specific (e.g. California residential rules differ from commercial practice and from other states)."],
    legalContextIds: ["us-ca-civil-tenancy", "uk-landlord-tenant-1954", "de-bgb-contracts", "fr-code-civil-contracts", "nl-bw-contracts"],
    version: 1,
  },
  {
    id: "lease-term-termination",
    dealTypes: ["lease"],
    protectionCategories: ["term", "termination"],
    title: "Term, renewal, and termination",
    purpose: "States how long the lease runs and how either side can end it.",
    variables: [
      { key: "lease_term", label: "Lease term", required: true, placeholder: "[e.g. 12 months from 1 March]" },
      { key: "notice_period", label: "Notice period", required: true, placeholder: "[e.g. 2 months written notice]" },
    ],
    template: "The lease runs for {{lease_term}}. Either party may end the lease early on {{notice_period}} written notice for the agreed grounds (including material breach after cure). Renewal, if any, is on the agreed terms. Statutory protections (such as business-tenancy security of tenure where applicable) apply regardless of these terms.",
    warnings: ["This is drafting assistance, not a determination of enforceability. Statutory security of tenure or eviction procedures may override contractual notice."],
    legalContextIds: ["us-ca-civil-tenancy", "uk-landlord-tenant-1954", "de-bgb-contracts", "fr-code-civil-contracts", "nl-bw-contracts"],
    version: 1,
  },
  {
    id: "lease-maintenance-repairs",
    dealTypes: ["lease"],
    protectionCategories: ["maintenance"],
    title: "Maintenance and repairs",
    purpose: "Allocates who maintains the property and who pays for repairs.",
    variables: [
      { key: "maintenance_party", label: "Maintenance responsibility", required: true, placeholder: "[e.g. landlord for structure, tenant for interior]" },
      { key: "repair_allocation", label: "Repair cost allocation", required: true, placeholder: "[e.g. landlord above $X, tenant below]" },
    ],
    template: "Maintenance is allocated as follows: {{maintenance_party}}. Repair costs are allocated as follows: {{repair_allocation}}. Neither party may defer safety or habitability repairs. Fair wear is excluded from tenant repair liability.",
    warnings: ["This is drafting assistance, not a determination of enforceability. Habitability and safety duties are often non-delegable by statute."],
    legalContextIds: ["us-ca-civil-tenancy", "uk-landlord-tenant-1954", "de-bgb-contracts", "fr-code-civil-contracts", "nl-bw-contracts"],
    version: 1,
  },
  {
    id: "lease-subletting-consent",
    dealTypes: ["lease"],
    protectionCategories: ["transfer"],
    title: "Subletting and assignment consent",
    purpose: "Controls whether the tenant can pass the lease to someone else.",
    variables: [
      { key: "consent_mechanism", label: "Consent mechanism", required: true, placeholder: "[e.g. prior written consent, not to be unreasonably withheld]" },
    ],
    template: "The tenant shall not sublet, assign, or share possession without {{consent_mechanism}}. An assignee takes the lease subject to its terms. Consent procedures and statutory limits on refusal vary by jurisdiction.",
    warnings: ["This is drafting assistance, not a determination of enforceability. Some jurisdictions limit how consent may be refused or require a prescribed procedure."],
    legalContextIds: ["uk-landlord-tenant-1954", "de-bgb-contracts", "fr-code-civil-contracts", "nl-bw-contracts"],
    version: 1,
  },
]

const EMPLOYMENT_CLAUSES: ClauseTemplate[] = [
  {
    id: "employment-compensation-terms",
    dealTypes: ["employment"],
    protectionCategories: ["compensation"],
    title: "Compensation and pay frequency",
    purpose: "States pay, currency, frequency, and what is included.",
    variables: [
      { key: "salary_amount", label: "Salary/wage amount", required: true, placeholder: "[e.g. 60,000 per year]" },
      { key: "currency", label: "Currency", required: true, placeholder: "[e.g. USD]" },
      { key: "pay_frequency", label: "Pay frequency", required: true, placeholder: "[e.g. monthly]" },
    ],
    template: "Compensation is {{salary_amount}} {{currency}}, payable {{pay_frequency}}, subject to lawful deductions. Overtime, bonuses, and benefits, if any, are as separately stated. Pay must meet applicable minimum-wage and overtime law.",
    warnings: ["This is drafting assistance, not a determination of enforceability. Minimum wage, overtime, and deduction rules are jurisdiction-specific and change over time."],
    legalContextIds: ["us-flsa-wages", "uk-employment-rights-1996", "de-bgb-contracts", "fr-code-civil-contracts", "nl-bw-contracts"],
    version: 1,
  },
  {
    id: "employment-duties-probation",
    dealTypes: ["employment"],
    protectionCategories: ["roles", "term"],
    title: "Duties and probation",
    purpose: "States the role, key duties, and any probation terms.",
    variables: [
      { key: "job_title", label: "Job title", required: true, placeholder: "[e.g. Operations Manager]" },
      { key: "key_duties", label: "Key duties", required: true, placeholder: "[e.g. three to five main duties]" },
      { key: "probation_terms", label: "Probation terms", required: true, placeholder: "[e.g. 3 months, 1 week notice during probation / none]" },
    ],
    template: "The employee is engaged as {{job_title}}. Key duties are: {{key_duties}}. Probation terms are: {{probation_terms}}. Duties may evolve reasonably with the role; material changes require agreement.",
    warnings: ["This is drafting assistance, not a determination of enforceability. Probation length and dismissal protections during probation are jurisdiction-specific."],
    legalContextIds: ["de-bgb-contracts", "fr-code-civil-contracts", "nl-bw-contracts"],
    version: 1,
  },
  {
    id: "employment-termination-notice",
    dealTypes: ["employment"],
    protectionCategories: ["termination"],
    title: "Termination and notice",
    purpose: "States how either side can end the employment and on what notice.",
    variables: [
      { key: "termination_grounds", label: "Termination grounds", required: true, placeholder: "[e.g. either party on notice; immediate for gross misconduct]" },
      { key: "notice_period", label: "Notice period", required: true, placeholder: "[e.g. 1 month]" },
    ],
    template: "Either party may end the employment on {{notice_period}} written notice, or immediately for the following grounds: {{termination_grounds}}. Statutory minimum notice, unfair-dismissal protections, and redundancy rules apply regardless of these terms. Accrued pay and benefits are settled on departure.",
    warnings: ["This is drafting assistance, not a determination of enforceability. Statutory dismissal protections and notice minimums override shorter contractual terms."],
    legalContextIds: ["us-flsa-wages", "uk-employment-rights-1996", "de-bgb-contracts", "fr-code-civil-contracts", "nl-bw-contracts"],
    version: 1,
  },
]

export const CLAUSE_LIBRARY: ClauseTemplate[] = [...FOUNDER_CLAUSES, ...PARTNERSHIP_CLAUSES, ...PURCHASE_SALE_CLAUSES, ...LEASE_CLAUSES, ...EMPLOYMENT_CLAUSES]

export function clausesForDealType(dealType: string): ClauseTemplate[] {
  return CLAUSE_LIBRARY.filter((c) => c.dealTypes.includes(dealType as never))
}

export function clausesForProtectionCategory(dealType: string, category: string): ClauseTemplate[] {
  return CLAUSE_LIBRARY.filter((c) => c.dealTypes.includes(dealType as never) && c.protectionCategories.includes(category as never))
}

export function clauseById(id: string): ClauseTemplate | null {
  return CLAUSE_LIBRARY.find((c) => c.id === id) ?? null
}

export function renderClauseTemplate(template: string, variables: Record<string, string>): { rendered: string; missing: string[] } {
  const missing: string[] = []
  const rendered = template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = variables[key]
    if (typeof value === "string" && value.trim().length > 0) return value.trim()
    missing.push(key)
    return `{{${key}}}`
  })
  return { rendered, missing }
}
