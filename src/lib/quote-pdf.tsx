import "server-only";
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatBRL, formatContact, formatDate, formatPhone } from "@/lib/format";
import { formatQuoteNumber } from "@/lib/quotes-schema";

// PDF do orçamento para o cliente final: só o preço final, sem detalhamento de custo,
// margem, taxas, máquina ou material.

const VIOLETA = "#6D3BFF";
const TINTA = "#12091F";
const NEVOA = "#F5F3FF";
const LIMAO = "#C6F432";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: TINTA, paddingBottom: 56 },
  band: { backgroundColor: VIOLETA, color: "#FFFFFF", paddingHorizontal: 40, paddingVertical: 28 },
  businessName: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  contactLine: { fontSize: 10, color: "#FFFFFF", marginTop: 4 },
  content: { paddingHorizontal: 40, paddingTop: 28 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  muted: { color: "#5B5366" },
  sectionLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: VIOLETA,
    textTransform: "uppercase",
    marginTop: 22,
    marginBottom: 6,
  },
  customerName: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  tableHead: {
    flexDirection: "row",
    backgroundColor: VIOLETA,
    color: "#FFFFFF",
    paddingVertical: 7,
    paddingHorizontal: 8,
    fontFamily: "Helvetica-Bold",
    marginTop: 22,
  },
  row: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 8 },
  rowAlt: { backgroundColor: NEVOA },
  colItem: { flex: 1, paddingRight: 8 },
  colQty: { width: 40, textAlign: "right" },
  colUnit: { width: 95, textAlign: "right" },
  colSub: { width: 95, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: TINTA,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  totalLabel: { color: "#FFFFFF", fontSize: 12, fontFamily: "Helvetica-Bold" },
  totalValue: { color: LIMAO, fontSize: 16, fontFamily: "Helvetica-Bold" },
  notes: { lineHeight: 1.4 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#8A8294",
  },
});

export interface QuotePdfData {
  businessName: string;
  whatsapp: string | null;
  instagram: string | null;
  number: number;
  issuedAt: string;
  customerName: string;
  customerContact: string | null;
  validUntil: string | null;
  notes: string | null;
  totalBrl: number;
  items: {
    description: string;
    quantity: number;
    unitPriceBrl: number;
    subtotalBrl: number;
  }[];
}

function QuoteDocument({ data }: { data: QuotePdfData }) {
  const contact = [
    data.whatsapp ? `WhatsApp ${formatPhone(data.whatsapp)}` : null,
    data.instagram ? `Instagram @${data.instagram}` : null,
  ].filter((line): line is string => line !== null);

  return (
    <Document title={`Orçamento nº ${formatQuoteNumber(data.number)}`} author={data.businessName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.band}>
          <Text style={styles.businessName}>{data.businessName}</Text>
          {contact.map((line) => (
            <Text key={line} style={styles.contactLine}>
              {line}
            </Text>
          ))}
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Orçamento nº {formatQuoteNumber(data.number)}</Text>
            <Text style={styles.muted}>Emitido em {formatDate(data.issuedAt)}</Text>
          </View>

          <Text style={styles.sectionLabel}>Cliente</Text>
          <Text style={styles.customerName}>{data.customerName}</Text>
          {data.customerContact && <Text style={styles.muted}>{formatContact(data.customerContact)}</Text>}

          <View style={styles.tableHead} fixed>
            <Text style={styles.colItem}>Item</Text>
            <Text style={styles.colQty}>Qtd.</Text>
            <Text style={styles.colUnit}>Valor unitário</Text>
            <Text style={styles.colSub}>Subtotal</Text>
          </View>
          {data.items.map((item, index) => (
            <View
              key={index}
              style={index % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row}
              wrap={false}
            >
              <Text style={styles.colItem}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colUnit}>{formatBRL(item.unitPriceBrl)}</Text>
              <Text style={styles.colSub}>{formatBRL(item.subtotalBrl)}</Text>
            </View>
          ))}

          <View style={styles.totalRow} wrap={false}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatBRL(data.totalBrl)}</Text>
          </View>

          {data.validUntil && (
            <Text style={[styles.muted, { marginTop: 14 }]}>
              Válido até {formatDate(data.validUntil)}
            </Text>
          )}

          {data.notes && (
            <>
              <Text style={styles.sectionLabel}>Observações</Text>
              <Text style={styles.notes}>{data.notes}</Text>
            </>
          )}
        </View>

        <Text style={styles.footer} fixed>
          Orçamento gerado pelo Voxa3D
        </Text>
      </Page>
    </Document>
  );
}

export function renderQuotePdf(data: QuotePdfData): Promise<Buffer> {
  return renderToBuffer(<QuoteDocument data={data} />);
}
