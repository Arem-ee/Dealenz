import { Body, Container, Head, Heading, Html, Link, Section, Text } from "@react-email/components"

export interface DigestMetric {
  title: string
  summary: string
}

export interface DigestEmailProps {
  reportName: string
  metricTitle: string
  windowLabel: string
  headline: string
  metrics: DigestMetric[]
  manageUrl: string
}

// Scheduled report digest: what changed, top rows, one link back. Plain
// tables, no images, no tracking pixels — transactional mail stays quiet.
export function DigestEmail({
  reportName,
  metricTitle,
  windowLabel,
  headline,
  metrics,
  manageUrl,
}: DigestEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "Helvetica, Arial, sans-serif", color: "#1C1917", backgroundColor: "#FAFAF8", padding: "24px" }}>
        <Container style={{ maxWidth: "560px", backgroundColor: "#FFFFFF", border: "1px solid #E4E1DC", padding: "24px" }}>
          <Heading as="h2" style={{ fontSize: "18px", margin: "0 0 4px" }}>
            {headline}
          </Heading>
          <Text style={{ fontSize: "13px", color: "#57534E", margin: "0 0 16px" }}>
            {reportName} · {metricTitle} · {windowLabel}
          </Text>
          {metrics.map((m) => (
            <Section key={m.title} style={{ borderTop: "1px solid #E4E1DC", padding: "12px 0" }}>
              <Text style={{ fontSize: "14px", fontWeight: "bold", margin: "0 0 4px" }}>{m.title}</Text>
              <Text style={{ fontSize: "13px", margin: 0 }}>{m.summary}</Text>
            </Section>
          ))}
          <Section style={{ marginTop: "16px" }}>
            <Link href={manageUrl} style={{ fontSize: "13px", color: "#047857" }}>
              Open in Dealenz
            </Link>
            <Text style={{ fontSize: "11px", color: "#57534E" }}>
              Pause or delete this schedule anytime from Reports → Saved reports.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
