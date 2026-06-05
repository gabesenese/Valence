import Anthropic from '@anthropic-ai/sdk';

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

const client = new Anthropic();

export async function extractLeaseFromPDF(pdfBuffer: Buffer): Promise<ExtractedLease> {
  const base64 = pdfBuffer.toString('base64');

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    tools: [
      {
        name: 'extract_lease_data',
        description: 'Extract all key lease terms from the provided lease document.',
        input_schema: {
          type: 'object' as const,
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
            leaseType:       {
              type: 'string',
              enum: ['GROSS', 'NET', 'MODIFIED_GROSS', 'PERCENTAGE', 'GROUND'],
              description: 'Lease structure type. GROSS = landlord pays operating expenses; NET = tenant pays; MODIFIED_GROSS = split; PERCENTAGE = base + % of revenue; GROUND = land only',
            },
            renewalOptions:  { type: 'string',  description: 'Renewal option terms (e.g. "Two 5-year options at fair market rent with 12-month notice")' },
            obligations:     { type: 'string',  description: 'Key tenant obligations: maintenance, utilities, insurance, etc.' },
            notes:           { type: 'string',  description: 'Other important clauses: exclusivity, co-tenancy, early termination, etc.' },
          },
          required: [],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'extract_lease_data' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          } as Parameters<typeof client.messages.create>[0]['messages'][0]['content'][0],
          {
            type: 'text',
            text: 'Extract all key lease terms from this document. Omit any field you cannot find or determine with confidence.',
          },
        ],
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Extraction failed: Claude did not return structured data');
  }

  const i = toolUse.input as Record<string, unknown>;
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
