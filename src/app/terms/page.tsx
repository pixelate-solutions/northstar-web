import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Northstar",
  description: "Northstar terms of service.",
};

const sectionStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: "28px 24px",
  boxShadow: "0 12px 32px rgba(15,23,42,0.05)",
};

export default function TermsPage() {
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
              "linear-gradient(145deg, rgba(237,247,255,0.98) 0%, rgba(255,255,255,0.98) 50%, rgba(237,251,243,0.98) 100%)",
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
            Terms of Service
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
            Basic rules for using Northstar.
          </h1>
          <p style={{ fontSize: 16, color: "#475569", lineHeight: 1.7, maxWidth: 680 }}>
            Effective March 28, 2026. These short-form terms govern access to the current
            Northstar product.
          </p>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <section style={sectionStyle}>
            <h2 style={{ fontSize: 20, color: "#0f172a", marginBottom: 10 }}>Use of the service</h2>
            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.75 }}>
              You may use Northstar only for lawful purposes and in a way that does not interfere
              with the product, the platform, or other users. You are responsible for activity that
              occurs under your account and for the accuracy of information you submit.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={{ fontSize: 20, color: "#0f172a", marginBottom: 10 }}>Accounts and access</h2>
            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.75 }}>
              Some features require an account, payment, or connected third-party service. Access to
              paid features may be suspended or revoked if payments are reversed, fraudulent activity
              is detected, or the service is abused.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={{ fontSize: 20, color: "#0f172a", marginBottom: 10 }}>
              AI suggestions and travel decisions
            </h2>
            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.75 }}>
              Northstar may generate plans, budgets, recommendations, and booking assistance using
              AI and third-party data. Those outputs are for planning support only. You are
              responsible for reviewing important details such as dates, prices, availability,
              cancellation terms, travel times, visas, and safety requirements before acting on them.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={{ fontSize: 20, color: "#0f172a", marginBottom: 10 }}>
              External providers
            </h2>
            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.75 }}>
              Northstar may link to or integrate with third-party providers such as Google, booking
              partners, airlines, hotels, tours, and payment processors. Those services operate
              under their own terms and policies, and Northstar is not responsible for their conduct
              or performance.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={{ fontSize: 20, color: "#0f172a", marginBottom: 10 }}>
              Intellectual property
            </h2>
            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.75 }}>
              Northstar, including its software, branding, and product content, is owned by its
              operator except where third-party rights apply. You retain rights to the trip content
              and personal information you provide, subject to the rights needed for us to operate
              the service.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={{ fontSize: 20, color: "#0f172a", marginBottom: 10 }}>
              Disclaimers and liability
            </h2>
            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.75 }}>
              Northstar is provided on an as-is and as-available basis. To the maximum extent
              permitted by law, we disclaim warranties and are not liable for indirect, incidental,
              special, consequential, or punitive damages arising from your use of the service.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={{ fontSize: 20, color: "#0f172a", marginBottom: 10 }}>Changes</h2>
            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.75 }}>
              We may update these terms as the product evolves. Continued use of Northstar after an
              update means you accept the revised terms.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
