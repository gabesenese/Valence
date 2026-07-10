import { EXPENSE_CATEGORIES } from '@valence/shared';

export type ImportTab = 'properties' | 'leases' | 'expenses';

export interface FieldDef {
  value: string;
  label: string;
  required: boolean;
  hint?: string;
  placeholder?: string;
  enumValues?: string[];
  docExample?: string;
  docFormat?: string;
}

export const FIELD_DEFS: Record<ImportTab, FieldDef[]> = {
  properties: [
    { value: 'name',          label: 'Property Name',     required: true,  placeholder: 'e.g. Sunset Office Tower',       docFormat: 'Any text',           docExample: 'Sunset Office Tower' },
    { value: 'code',          label: 'Property Code',     required: true,  placeholder: 'e.g. APN-1234',                  docFormat: 'Unique text/number',  docExample: 'APN-1234', hint: 'Unique ID used to link leases (roll number, APN, PID)' },
    { value: 'type',          label: 'Type',              required: true,  placeholder: 'e.g. COMMERCIAL',                docFormat: 'Enum (see values)',   docExample: 'COMMERCIAL',
      enumValues: ['RESIDENTIAL', 'COMMERCIAL', 'MIXED_USE', 'INDUSTRIAL', 'RETAIL', 'OFFICE'],
      hint: 'RESIDENTIAL · COMMERCIAL · MIXED_USE · INDUSTRIAL · RETAIL · OFFICE' },
    { value: 'address',       label: 'Street Address',    required: true,  placeholder: 'e.g. 123 Main St',               docFormat: 'Street address',      docExample: '123 Main St' },
    { value: 'city',          label: 'City',              required: true,  placeholder: 'e.g. Toronto',                   docFormat: 'City name',           docExample: 'Toronto' },
    { value: 'state',         label: 'State / Province',  required: true,  placeholder: 'e.g. ON or BC',                  docFormat: '2-letter code',       docExample: 'ON', hint: '2-letter code (ON, BC, AB)' },
    { value: 'zipCode',       label: 'ZIP / Postal Code', required: true,  placeholder: 'e.g. M5V 3A8',                   docFormat: 'ZIP or postal',       docExample: 'M5V 3A8' },
    { value: 'totalUnits',    label: 'Total Units',       required: true,  placeholder: 'e.g. 24',                        docFormat: 'Integer',             docExample: '24' },
    { value: 'totalSqft',     label: 'Total Sq Ft',       required: false, placeholder: 'e.g. 18500',                     docFormat: 'Number',              docExample: '18500' },
    { value: 'yearBuilt',     label: 'Year Built',        required: false, placeholder: 'e.g. 1998',                      docFormat: '4-digit year',        docExample: '1998' },
    { value: 'purchasePrice', label: 'Purchase Price',    required: false, placeholder: 'e.g. 4500000',                   docFormat: 'Number (no commas)',  docExample: '4500000' },
    { value: 'currentValue',  label: 'Current Value',     required: false, placeholder: 'e.g. 5200000',                   docFormat: 'Number (no commas)',  docExample: '5200000' },
    { value: 'purchaseDate',  label: 'Purchase Date',     required: false, placeholder: 'e.g. 2019-03-15',                docFormat: 'YYYY-MM-DD',          docExample: '2019-03-15' },
    { value: 'country',       label: 'Country',           required: false, placeholder: 'e.g. CA',                        docFormat: '2-letter ISO code',   docExample: 'CA' },
  ],
  leases: [
    { value: 'propertyCode',    label: 'Property Code',    required: true,  placeholder: 'e.g. APN-1234',                  docFormat: 'Must match existing property', docExample: 'APN-1234',  hint: 'Must match an existing property code' },
    { value: 'tenantName',      label: 'Tenant Name',      required: true,  placeholder: 'e.g. Acme Corp',                 docFormat: 'Any text',            docExample: 'Acme Corp' },
    { value: 'leaseNumber',     label: 'Lease Number',     required: true,  placeholder: 'e.g. LSE-2024-001',              docFormat: 'Unique per property', docExample: 'LSE-2024-001', hint: 'Unique identifier per property' },
    { value: 'startDate',       label: 'Start Date',       required: true,  placeholder: 'e.g. 2024-01-01',                docFormat: 'YYYY-MM-DD',          docExample: '2024-01-01',  hint: 'YYYY-MM-DD format' },
    { value: 'endDate',         label: 'End Date',         required: true,  placeholder: 'e.g. 2026-12-31',                docFormat: 'YYYY-MM-DD',          docExample: '2026-12-31',  hint: 'YYYY-MM-DD format' },
    { value: 'baseRent',        label: 'Base Rent',        required: true,  placeholder: 'e.g. 3500',                      docFormat: 'Monthly $ (no commas)', docExample: '3500',       hint: 'Monthly amount in dollars' },
    { value: 'tenantEmail',     label: 'Tenant Email',     required: false, placeholder: 'e.g. tenant@company.com',        docFormat: 'Email address',       docExample: 'tenant@company.com' },
    { value: 'type',            label: 'Lease Type',       required: false, placeholder: 'e.g. GROSS',                     docFormat: 'Enum (see values)',   docExample: 'GROSS',
      enumValues: ['GROSS', 'NET', 'MODIFIED_GROSS', 'PERCENTAGE', 'GROUND'],
      hint: 'GROSS · NET · MODIFIED_GROSS · PERCENTAGE · GROUND' },
    { value: 'unitNumber',      label: 'Unit Number',      required: false, placeholder: 'e.g. Suite 301',                 docFormat: 'Any text',            docExample: 'Suite 301' },
    { value: 'rentEscalation',  label: 'Rent Escalation',  required: false, placeholder: 'e.g. 0.03 (= 3%)',              docFormat: 'Decimal rate',        docExample: '0.03',       hint: 'Annual rate e.g. 0.03 = 3%' },
    { value: 'securityDeposit', label: 'Security Deposit', required: false, placeholder: 'e.g. 7000',                      docFormat: 'Number (no commas)',  docExample: '7000' },
    { value: 'sqft',            label: 'Leased Sq Ft',     required: false, placeholder: 'e.g. 2400',                      docFormat: 'Number',              docExample: '2400' },
    { value: 'lateFeeType',     label: 'Late Fee Type',    required: false, placeholder: 'e.g. PERCENTAGE',                docFormat: 'Enum (see values)',   docExample: 'PERCENTAGE',
      enumValues: ['NONE', 'FLAT', 'PERCENTAGE'],
      hint: 'NONE · FLAT (fixed $) · PERCENTAGE (% of rent)' },
    { value: 'lateFeeFlat',     label: 'Late Fee (Flat)',  required: false, placeholder: 'e.g. 75',                        docFormat: 'Number (no commas)',  docExample: '75',         hint: 'Fixed dollar fee — used when Late Fee Type is FLAT' },
    { value: 'lateFeePercent',  label: 'Late Fee (%)',     required: false, placeholder: 'e.g. 5',                         docFormat: 'Percent 0–100',       docExample: '5',          hint: '% of rent — used when Late Fee Type is PERCENTAGE' },
    { value: 'lateFeeGraceDays',label: 'Grace Period (days)', required: false, placeholder: 'e.g. 5',                      docFormat: 'Integer 0–90',        docExample: '5' },
    { value: 'lateFeeInterestPct', label: 'Monthly Interest (%)', required: false, placeholder: 'e.g. 1.5',               docFormat: 'Percent 0–100',       docExample: '1.5',        hint: 'Monthly interest on overdue balance' },
    { value: 'notes',           label: 'Notes',            required: false, placeholder: 'e.g. Month-to-month renewal',    docFormat: 'Any text',            docExample: 'Month-to-month renewal' },
  ],
  expenses: [
    { value: 'propertyCode', label: 'Property Code', required: true,  placeholder: 'e.g. APN-1234',     docFormat: 'Must match existing property', docExample: 'APN-1234', hint: 'Must match an existing property code' },
    { value: 'date',         label: 'Date',          required: true,  placeholder: 'e.g. 2026-01-15',   docFormat: 'YYYY-MM-DD',          docExample: '2026-01-15', hint: 'The expense date / period' },
    { value: 'amount',       label: 'Amount',        required: true,  placeholder: 'e.g. 1200',         docFormat: 'Number (no commas)',  docExample: '1200' },
    { value: 'category',     label: 'Category',      required: false, placeholder: 'e.g. UTILITIES',    docFormat: 'Enum (see values)',   docExample: 'UTILITIES',
      enumValues: EXPENSE_CATEGORIES.map((c) => c.value),
      hint: 'Defaults to OTHER if blank or unrecognized' },
    { value: 'description',  label: 'Description',    required: false, placeholder: 'e.g. Q1 hydro bill', docFormat: 'Any text',           docExample: 'Q1 hydro bill' },
    { value: 'dueDate',      label: 'Due Date',      required: false, placeholder: 'e.g. 2026-02-01',   docFormat: 'YYYY-MM-DD',          docExample: '2026-02-01' },
  ],
};

export function norm(s: string) { return s.toLowerCase().replace(/[\s_\-.]+/g, ''); }

const PROP_ALIASES: Record<string, string> = {
  name: 'name', propertyname: 'name', buildingname: 'name', assetname: 'name', title: 'name', sitename: 'name',
  code: 'code', propertycode: 'code', propcode: 'code', rollnumber: 'code', roll: 'code',
  parcelid: 'code', apn: 'code', propertyid: 'code', assessmentrollnumber: 'code', pid: 'code',
  rsn: 'code', registrationserialnumber: 'code', serialnumber: 'code', registrationno: 'code',
  type: 'type', propertytype: 'type', assettype: 'type', usetype: 'type', landuse: 'type', useclass: 'type', propertyclass: 'type',
  address: 'address', streetaddress: 'address', addressfull: 'address', fulladdress: 'address',
  street: 'address', addressline1: 'address', civicaddress: 'address', siteaddress: 'address',
  city: 'city', municipality: 'city', town: 'city', cityname: 'city', locality: 'city',
  state: 'state', province: 'state', stateprovince: 'state', prov: 'state', statecode: 'state', provincecode: 'state',
  zipcode: 'zipCode', zip: 'zipCode', postalcode: 'zipCode', postcode: 'zipCode', postal: 'zipCode', pcode: 'zipCode',
  totalunits: 'totalUnits', units: 'totalUnits', numunits: 'totalUnits', unitcount: 'totalUnits', totalsuites: 'totalUnits',
  confirmedunits: 'totalUnits', noofunits: 'totalUnits', nofunits: 'totalUnits', numberofunits: 'totalUnits',
  totalsqft: 'totalSqft', squarefeet: 'totalSqft', area: 'totalSqft',
  totalarea: 'totalSqft', gfa: 'totalSqft', grossfloorarea: 'totalSqft', buildingarea: 'totalSqft',
  yearbuilt: 'yearBuilt', constructionyear: 'yearBuilt', builtyear: 'yearBuilt',
  purchaseprice: 'purchasePrice', acquisitionprice: 'purchasePrice',
  currentvalue: 'currentValue', assessedvalue: 'currentValue', marketvalue: 'currentValue', appraisedvalue: 'currentValue',
  purchasedate: 'purchaseDate', acquisitiondate: 'purchaseDate',
  country: 'country', countrycode: 'country',
};

const LEASE_ALIASES: Record<string, string> = {
  propertycode: 'propertyCode', propcode: 'propertyCode', property: 'propertyCode',
  tenantname: 'tenantName', tenant: 'tenantName', lessee: 'tenantName',
  leasenumber: 'leaseNumber', leaseno: 'leaseNumber', leaseid: 'leaseNumber', leaseref: 'leaseNumber',
  startdate: 'startDate', leasestart: 'startDate', commencement: 'startDate', commencementdate: 'startDate',
  enddate: 'endDate', leaseend: 'endDate', expiry: 'endDate', expirydate: 'endDate', expirationdate: 'endDate',
  baserent: 'baseRent', rent: 'baseRent', monthlyrent: 'baseRent', annualrent: 'baseRent', rentamount: 'baseRent',
  tenantemail: 'tenantEmail', email: 'tenantEmail',
  type: 'type', leasetype: 'type',
  unitnumber: 'unitNumber', unit: 'unitNumber', suite: 'unitNumber',
  rentescalation: 'rentEscalation', escalation: 'rentEscalation',
  securitydeposit: 'securityDeposit', deposit: 'securityDeposit',
  sqft: 'sqft', squarefeet: 'sqft', leasedarea: 'sqft',
  latefeetype: 'lateFeeType', latefee: 'lateFeeType',
  latefeeflat: 'lateFeeFlat', flatlatefee: 'lateFeeFlat', latefeeamount: 'lateFeeFlat',
  latefeepercent: 'lateFeePercent', latefeepct: 'lateFeePercent',
  latefeegracedays: 'lateFeeGraceDays', gracedays: 'lateFeeGraceDays', graceperiod: 'lateFeeGraceDays',
  latefeeinterestpct: 'lateFeeInterestPct', interestrate: 'lateFeeInterestPct', interest: 'lateFeeInterestPct',
  notes: 'notes', comments: 'notes', remarks: 'notes',
};

const EXPENSE_ALIASES: Record<string, string> = {
  propertycode: 'propertyCode', propcode: 'propertyCode', property: 'propertyCode',
  date: 'date', expensedate: 'date', period: 'date', postingdate: 'date', transactiondate: 'date', paiddate: 'date',
  amount: 'amount', cost: 'amount', total: 'amount', expense: 'amount', value: 'amount', paid: 'amount',
  category: 'category', expensetype: 'category', glcode: 'category', account: 'category', expensecategory: 'category',
  description: 'description', memo: 'description', details: 'description', vendor: 'description', payee: 'description',
  duedate: 'dueDate', due: 'dueDate',
};

export const TAB_ALIASES: Record<ImportTab, Record<string, string>> = { properties: PROP_ALIASES, leases: LEASE_ALIASES, expenses: EXPENSE_ALIASES };

export function autoSuggest(headers: string[], tab: ImportTab): Record<string, string> {
  const aliases = TAB_ALIASES[tab];
  const fields  = FIELD_DEFS[tab];
  const mapping: Record<string, string> = {};
  for (const field of fields) {
    for (const h of headers) {
      if (aliases[norm(h)] === field.value) { mapping[field.value] = h; break; }
    }
  }
  return mapping;
}

/*
 * How many of a tab's REQUIRED fields these headers can satisfy — the signal
 * behind entity detection. A leases rent-roll lights up propertyCode/dates/rent;
 * a properties sheet lights up address/city/units. The importer's own alias
 * tables do the recognizing, so detection never drifts from the mapper.
 */
export function requiredCoverage(headers: string[], tab: ImportTab): number {
  const mapping = autoSuggest(headers, tab);
  return FIELD_DEFS[tab].filter((f) => f.required && mapping[f.value]).length;
}

/* Pick the entity whose required columns these headers best cover. Null when
 * nothing clears a real bar (needs 2+ required matches). */
export function detectEntity(headers: string[]): ImportTab | null {
  const ranked = (['leases', 'properties', 'expenses'] as ImportTab[])
    .map((tab) => ({ tab, score: requiredCoverage(headers, tab) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  return best.score >= 2 ? best.tab : null;
}

/* Column map the import endpoints expect: { csvHeader: valenceField }. */
export function toColumnMap(headers: string[], tab: ImportTab): Record<string, string> {
  const suggested = autoSuggest(headers, tab);
  const columnMap: Record<string, string> = {};
  for (const [valenceField, csvHeader] of Object.entries(suggested)) {
    if (csvHeader) columnMap[csvHeader] = valenceField;
  }
  return columnMap;
}
