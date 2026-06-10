import { AboutLayout, Section } from './AboutLayout';

export default function PrivacyTermsPage() {
  return (
    <AboutLayout
      eyebrow="Legal"
      title="Privacy & Terms"
      intro="Plain-language summary of how Valence handles your data and the terms under which you use the platform. This page is a general template — have it reviewed by counsel before relying on it for your jurisdiction."
      updated="June 2026"
    >
      {/* Privacy */}
      <Section heading="1. Information we collect">
        <p>
          We collect the account information you provide (name, email, organization), the portfolio data you
          import (properties, leases, tenants, financials), and standard technical data such as log entries,
          device information, and usage events needed to operate and secure the service.
        </p>
      </Section>

      <Section heading="2. How we use it">
        <p>
          Your data is used to provide the service: surfacing risks, generating briefs and reports, and
          powering the Work Queue. We use aggregated, de-identified usage data to improve the product. We do
          not sell your data, and we do not use your portfolio data to train third-party models.
        </p>
      </Section>

      <Section heading="3. Sharing & subprocessors">
        <p>
          We share data only with the infrastructure and AI subprocessors required to run Valence (for
          example, hosting, database, email, and payment providers), each under contractual confidentiality
          and data-protection obligations. We disclose information when required by law or to protect the
          rights and safety of our users.
        </p>
      </Section>

      <Section heading="4. Your rights">
        <p>
          You can access, correct, export, or delete your data at any time. See{' '}
          <span className="text-brand-300">Data Controls</span> for how retention, export, and deletion work
          in practice. Depending on your jurisdiction you may have additional rights under regulations such as
          GDPR or CCPA, including the right to object to or restrict certain processing.
        </p>
      </Section>

      {/* Terms */}
      <Section heading="5. Use of the service">
        <p>
          Your subscription grants your organization a non-exclusive, non-transferable right to use Valence
          for its internal business operations. You're responsible for the accuracy of the data you import,
          for maintaining the confidentiality of your credentials, and for the actions of users in your
          account. You agree not to misuse the service, reverse-engineer it, or use it to violate any law.
        </p>
      </Section>

      <Section heading="6. Plans, billing & trials">
        <p>
          Paid plans are billed monthly in advance. Free trials convert to a paid plan only if you choose one;
          we'll never auto-charge without a plan selection. Usage allowances are fixed per plan with no
          surprise overages — see the Pricing page for current limits.
        </p>
      </Section>

      <Section heading="7. Disclaimers & liability">
        <p>
          Valence surfaces risks and insights to support your decisions, but it is a tool — not financial,
          legal, or investment advice. The service is provided “as is,” and to the maximum extent permitted by
          law our liability is limited to the fees you paid in the twelve months preceding a claim.
        </p>
      </Section>

      <Section heading="8. Contact">
        <p>
          Questions about privacy or these terms? Reach us at{' '}
          <a href="mailto:support@valenceos.ca" className="text-brand-300 hover:text-brand-200 transition-colors">
            support@valenceos.ca
          </a>
          .
        </p>
      </Section>
    </AboutLayout>
  );
}
