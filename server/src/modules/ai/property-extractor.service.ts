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

export interface ExtractedProperty {
  name:          string | null;
  type:          'RESIDENTIAL' | 'COMMERCIAL' | 'MIXED_USE' | 'INDUSTRIAL' | 'RETAIL' | 'OFFICE' | null;
  address:       string | null;
  city:          string | null;
  state:         string | null; // province / state code
  zipCode:       string | null; // postal code
  totalUnits:    number | null;
  totalSqft:     number | null;
  yearBuilt:     number | null;
  purchasePrice: number | null;
  currentValue:  number | null;
}

export async function extractPropertyFromPDF(pdfBuffer: Buffer): Promise<ExtractedProperty> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('AI extraction is not configured on this server.');
  }

  const { text } = await pdfParse(pdfBuffer);

  const response = await groq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{
      role: 'user',
      content: `Extract the key details of the property described in the document below. This may be an offering memorandum, appraisal, rent roll, purchase agreement, or property data sheet. Only include a field if the value is explicitly stated — do not include fields that are absent, and never use "null", "N/A", or empty strings as values.\n\n${text}`,
    }],
    tools: [{
      type: 'function',
      function: {
        name: 'extract_property_data',
        description: 'Extract key property details. Only populate fields that are explicitly present in the document.',
        parameters: {
          type: 'object',
          properties: {
            name:    { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Building or property name (e.g. "Oakwood Plaza")' },
            type: {
              anyOf: [
                { type: 'string', enum: ['RESIDENTIAL', 'COMMERCIAL', 'MIXED_USE', 'INDUSTRIAL', 'RETAIL', 'OFFICE'] },
                { type: 'null' },
              ],
              description: 'Property classification',
            },
            address: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Street address only, without city/province/postal' },
            city:    { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'City or municipality' },
            state:   { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Two-letter province or state code (e.g. ON, CA)' },
            zipCode: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Postal or ZIP code' },
            totalUnits:    { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'Total number of rentable units' },
            totalSqft:     { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'Total rentable or gross building area in square feet' },
            yearBuilt:     { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'Year the building was constructed' },
            purchasePrice: { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'Purchase or acquisition price as a plain number' },
            currentValue:  { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'Current appraised or market value as a plain number' },
          },
        },
      },
    }],
    tool_choice: { type: 'function', function: { name: 'extract_property_data' } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== 'function') {
    throw new Error('Extraction failed: model did not return structured data');
  }

  const i = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
  return {
    name:          (i.name          as string | undefined) ?? null,
    type:          (i.type          as ExtractedProperty['type'] | undefined) ?? null,
    address:       (i.address       as string | undefined) ?? null,
    city:          (i.city          as string | undefined) ?? null,
    state:         (i.state         as string | undefined) ?? null,
    zipCode:       (i.zipCode       as string | undefined) ?? null,
    totalUnits:    (i.totalUnits    as number | undefined) ?? null,
    totalSqft:     (i.totalSqft     as number | undefined) ?? null,
    yearBuilt:     (i.yearBuilt     as number | undefined) ?? null,
    purchasePrice: (i.purchasePrice as number | undefined) ?? null,
    currentValue:  (i.currentValue  as number | undefined) ?? null,
  };
}
