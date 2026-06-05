import Groq from 'groq-sdk';
// pdf-parse is CJS-only; require avoids ESM interop issues under NodeNext
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;

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

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function extractLeaseFromPDF(pdfBuffer: Buffer): Promise<ExtractedLease> {
  const { text } = await pdfParse(pdfBuffer);

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{
      role: 'user',
      content: `Extract all key lease terms from the document below. Omit any field you cannot find or determine with confidence.\n\n${text}`,
    }],
    tools: [{
      type: 'function',
      function: {
        name: 'extract_lease_data',
        description: 'Extract all key lease terms from the provided lease document.',
        parameters: {
          type: 'object',
          properties: {
            tenantName:      { type: 'string',  description: 'Full legal name of the tenant or lessee' },
            propertyAddress: { type: 'string',  description: 'Full street address of the leased property' },
            unitNumber:      { type: 'string',  description: 'Unit, suite, or space number if specified' },
            startDate:       { type: 'string',  description: 'Lease commencement date in YYYY-MM-DD format' },
            endDate:         { type: 'string',  description: 'Lease expiration date in YYYY-MM-DD format' },
            baseRent:        { type: 'number',  description: 'Monthly base rent in USD as a plain number' },
            rentEscalation:  { type: 'number',  description: 'Annual rent escalation as a percentage (e.g. 3.0 for 3%)' },
            securityDeposit: { type: 'number',  description: 'Security deposit amount in USD as a plain number' },
            sqft:            { type: 'number',  description: 'Rentable square footage of the leased space' },
            leaseType: {
              type: 'string',
              enum: ['GROSS', 'NET', 'MODIFIED_GROSS', 'PERCENTAGE', 'GROUND'],
              description: 'Lease structure type',
            },
            renewalOptions:  { type: 'string',  description: 'Renewal option terms' },
            obligations:     { type: 'string',  description: 'Key tenant obligations: maintenance, utilities, insurance, etc.' },
            notes:           { type: 'string',  description: 'Other important clauses: exclusivity, co-tenancy, early termination, etc.' },
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
