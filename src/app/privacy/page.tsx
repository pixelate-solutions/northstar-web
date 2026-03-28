import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Northstar",
  description: "Northstar privacy policy.",
};

const sectionStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: "28px 24px",
  boxShadow: "0 12px 32px rgba(15,23,42,0.05)",
};

export default function PrivacyPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f5f7fb 0%, #eef4f7 100%)",
        padding: "48px 20px 72px",
      }}
    >
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            marginBottom: 20,
            fontSize: 14,
            fontWeight: 600,
            color: "#475569",
            textDecoration: "none",
          }}
        >
          ← Back to Northstar
        </Link>

        <div
          style={{
            ...sectionStyle,
            marginBottom: 16,
            padding: "40px 32px",
            background:
              "linear-gradient(145deg, rgba(255,248,236,0.98) 0%, rgba(255,255,255,0.98) 55%, rgba(237,247,255,0.98) 100%)",
          }}
        >
          <p
            style={{
              marginBottom: 14,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#64748b",
            }}
          >
            Privacy Policy
          </p>
          <h1
            style={{
              fontSize: 40,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: "#0f172a",
              marginBottom: 12,
            }}
          >
            How Northstar handles your data.
          </h1>
          <p style={{ fontSize: 16, color: "#475569", lineHeight: 1.7, maxWidth: 680 }}>
            Effective March 28, 2026. This is a short-form privacy policy for the current
            Northstar product. It explains what we collect, why we collect it, and how we use it.
          </p>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <section style={sectionStyle}>
            <h2 style={{ fontSize: 20, color: "#0f172a", marginBottom: 10 }}>What we collect</h2>
            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.75 }}>
              We collect information you provide directly, including account details, trip data,
              itinerary items, budgets, packing lists, reminders, and messages you send to the AI
              concierge. If you connect third-party services such as Google, we may also collect
              limited reservation and calendar data needed to support the features you enable.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={{ fontSize: 20, color: "#0f172a", marginBottom: 10 }}>How we use it</h2>
            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.75 }}>
              We use your information to operate the app, save your trips, power AI planning and
              recommendations, process payments, support connected integrations, improve product
              reliability, and protect the service from abuse.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={{ fontSize: 20, color: "#0f172a", marginBottom: 10 }}>
              AI, search, and third-party services
            </h2>
            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.75 }}>
              When you use AI features, prompts and relevant trip context may be sent to model and
              search providers to generate answers, research travel options, and complete requested
              actions. When you connect third-party services, we only use the scopes and data needed
              for the enabled workflow.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={{ fontSize: 20, color: "#0f172a", marginBottom: 10 }}>
              Sharing and storage
            </h2>
            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.75 }}>
              We do not sell your personal information. We share data with service providers that
              help us run Northstar, such as hosting, authentication, payments, AI, and connected
              integrations. We store data for as long as needed to operate the service, meet legal
              obligations, and resolve disputes.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={{ fontSize: 20, color: "#0f172a", marginBottom: 10 }}>
              Your choices
            </h2>
            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.75 }}>
              You can disconnect integrations, edit or delete trip content inside the app, and stop
              using the service at any time. If you need account or data deletion help, contact us
              and we will process the request in line with applicable law and our operational
              requirements.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={{ fontSize: 20, color: "#0f172a", marginBottom: 10 }}>Contact</h2>
            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.75 }}>
              For privacy questions, use the support contact associated with your Northstar account
              or business contact channel. Update this page with a dedicated privacy email before
              public launch if you want a formal legal contact listed here.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
