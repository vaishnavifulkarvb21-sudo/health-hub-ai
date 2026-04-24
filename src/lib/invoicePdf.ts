import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface InvoiceLine {
  description: string;
  amount: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  patient: { name: string; code: string; phone?: string | null; address?: string | null };
  doctor?: string | null;
  lines: InvoiceLine[];
  notes?: string;
  status?: string;
  clinicName?: string;
  clinicAddress?: string;
}

export function downloadInvoicePdf(data: InvoiceData) {
  const doc = new jsPDF();
  const clinicName = data.clinicName ?? "MedPulse AI";
  const clinicAddress = data.clinicAddress ?? "Smart Healthcare Management System";

  // Header band
  doc.setFillColor(20, 150, 160);
  doc.rect(0, 0, 210, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(clinicName, 14, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(clinicAddress, 14, 22);

  // Invoice meta (right)
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("INVOICE", 196, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`#${data.invoiceNumber}`, 196, 22, { align: "right" });

  // Body text
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Bill to", 14, 44);
  doc.setFont("helvetica", "normal");
  doc.text(data.patient.name, 14, 50);
  doc.text(`Patient ID: ${data.patient.code}`, 14, 56);
  if (data.patient.phone) doc.text(`Phone: ${data.patient.phone}`, 14, 62);
  if (data.patient.address) doc.text(`Address: ${data.patient.address}`, 14, 68);

  doc.setFont("helvetica", "bold");
  doc.text("Date", 140, 44);
  doc.setFont("helvetica", "normal");
  doc.text(data.date, 140, 50);
  if (data.doctor) {
    doc.setFont("helvetica", "bold");
    doc.text("Attending", 140, 58);
    doc.setFont("helvetica", "normal");
    doc.text(data.doctor, 140, 64);
  }

  const total = data.lines.reduce((s, l) => s + Number(l.amount || 0), 0);

  autoTable(doc, {
    startY: 80,
    head: [["#", "Description", "Amount (INR)"]],
    body: data.lines.map((l, i) => [i + 1, l.description, Number(l.amount).toFixed(2)]),
    foot: [["", "Total", total.toFixed(2)]],
    theme: "striped",
    headStyles: { fillColor: [20, 150, 160], textColor: 255 },
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
    styles: { fontSize: 10 },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;

  if (data.status) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const statusColor: [number, number, number] = data.status === "paid" ? [40, 160, 90] : [200, 60, 60];
    doc.setTextColor(...statusColor);
    doc.text(`Status: ${data.status.toUpperCase()}`, 14, finalY + 12);
    doc.setTextColor(30, 30, 30);
  }

  if (data.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(`Notes: ${data.notes}`, 14, finalY + 22);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("This is a computer-generated invoice. Thank you for choosing MedPulse AI.", 14, 285);

  doc.save(`Invoice-${data.invoiceNumber}.pdf`);
}
