// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;

let _groq: import('groq-sdk').default | null = null;
function groq() {
  if (!_groq) {
    const Groq = require('groq-sdk').default as typeof import('groq-sdk').default;
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

export interface ExtractedLease {
  tenantName:      string | null;
  propertyAddress: string | null;
  unitNumber:      string | null;
  startDate:       string | null; // YYYY-MM-DD
  endDate:         string | null; // YYYY-MM-DD
  baseRent:        number | null;
  rentEscalation:  number | null; // annual %
  securityDeposit: number | null;
  sqft:            number | null;
  leaseType:       'GROSS' | 'NET' | 'MODIFIED_GROSS' | 'PERCENTAGE' | 'GROUND' | null;
  renewalOptions:  string | null;
  obligations:     string | null;
  notes:           string | null;
}

export async function extractLeaseFromPDF(pdfBuffer: Buffer): Promise<ExtractedLease> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('AI extraction is not configured on this server.');
  }

  const { text } = await pdfParse(pdfBuffer);

  const response = await groq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{
      role: 'user',
      content: `Extract all key lease terms from the document below. Only include a field if the value is explicitly stated — do not include fields that are absent, and never use "null", "N/A", or empty strings as values.\n\n${text}`,
    }],
    tools: [{
      type: 'function',
      function: {
        name: 'extract_lease_data',
        description: 'Extract key lease terms. Only populate fields that are explicitly present in the document.',
        parameters: {
          type: 'object',
          properties: {
            tenantName:      { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Full legal name of the tenant or lessee' },
            propertyAddress: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Full street address of the leased property' },
            unitNumber:      { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Unit, suite, or space number if specified' },
            startDate:       { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Lease commencement date in YYYY-MM-DD format' },
            endDate:         { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Lease expiration date in YYYY-MM-DD format' },
            baseRent:        { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'Monthly base rent as a plain number' },
            rentEscalation:  { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'Annual rent escalation as a percentage (e.g. 3.0 for 3%)' },
            securityDeposit: { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'Security deposit amount as a plain number' },
            sqft:            { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'Rentable square footage of the leased space' },
            leaseType: {
              anyOf: [
                { type: 'string', enum: ['GROSS', 'NET', 'MODIFIED_GROSS', 'PERCENTAGE', 'GROUND'] },
                { type: 'null' },
              ],
              description: 'Lease structure type',
            },
            renewalOptions:  { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Renewal option terms' },
            obligations:     { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Key tenant obligations: maintenance, utilities, insurance, etc.' },
            notes:           { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Other important clauses: exclusivity, co-tenancy, early termination, etc.' },
          },
        },
      },
    }],
    tool_choice: { type: 'function', function: { name: 'extract_lease_data' } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== 'function') {
    throw new Error('Extraction failed: model did not return structured data');
  }

  const i = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
  return {
    tenantName:      (i.tenantName      as string | undefined) ?? null,
    propertyAddress: (i.propertyAddress as string | undefined) ?? null,
    unitNumber:      (i.unitNumber      as string | undefined) ?? null,
    startDate:       (i.startDate       as string | undefined) ?? null,
    endDate:         (i.endDate         as string | undefined) ?? null,
    baseRent:        (i.baseRent        as number | undefined) ?? null,
    rentEscalation:  (i.rentEscalation  as number | undefined) ?? null,
    securityDeposit: (i.securityDeposit as number | undefined) ?? null,
    sqft:            (i.sqft            as number | undefined) ?? null,
    leaseType:       (i.leaseType       as ExtractedLease['leaseType'] | undefined) ?? null,
    renewalOptions:  (i.renewalOptions  as string | undefined) ?? null,
    obligations:     (i.obligations     as string | undefined) ?? null,
    notes:           (i.notes           as string | undefined) ?? null,
  };
}
