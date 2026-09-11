// src/services/report-generation.service.ts
//
// Shared CSV/Excel/PDF rendering for the CRM's downloadable reports
// (properties, leads, payments, ad performance). Deliberately generic --
// callers (report.controller.ts) shape their own resource's rows into a
// plain ReportTable, so this file never needs to know what a "lead" or
// "payment" is.
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import path from 'path';

export type ReportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ReportTable {
  title: string;
  generatedAt: Date;
  // Small key/value lines shown above the table (e.g. "Total amount: Ksh 4,200,000") -- optional.
  summary?: { label: string; value: string }[];
  headers: string[];
  rows: (string | number)[][];
}

// Not copied into dist/ by `tsc` (it only compiles .ts), so this reads the
// source file directly off disk via the process's cwd -- the deploy layout
// (rsync into the project root, run from there) always has src/assets/
// alongside dist/, so this resolves correctly in both `ts-node` (local/dev)
// and the compiled `node dist/server.js` (production) entry points.
const LOGO_PATH = path.join(process.cwd(), 'src/assets/logo.jpg');
const BRAND_GOLD = '#b8863f';
const BRAND_INK = '#1a1a1a';
const BRAND_MUTED = '#6b6b6b';

const escapeCsvCell = (cell: string | number): string => {
  const s = String(cell);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (table: ReportTable): string => {
  const lines = [table.headers.map(escapeCsvCell).join(',')];
  for (const row of table.rows) lines.push(row.map(escapeCsvCell).join(','));
  return lines.join('\n');
};

export const toXlsx = async (table: ReportTable): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Chestone Properties CRM';
  workbook.created = table.generatedAt;

  const sheet = workbook.addWorksheet(table.title.slice(0, 31) || 'Report');

  sheet.addRow([table.title]);
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.addRow([`Generated ${table.generatedAt.toLocaleString('en-KE')}`]);
  sheet.getRow(2).font = { italic: true, size: 9, color: { argb: 'FF666666' } };
  sheet.addRow([]);

  if (table.summary?.length) {
    for (const s of table.summary) {
      const row = sheet.addRow([s.label, s.value]);
      row.getCell(1).font = { bold: true };
    }
    sheet.addRow([]);
  }

  const headerRow = sheet.addRow(table.headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1A' } };
  });

  for (const row of table.rows) sheet.addRow(row);
  sheet.columns.forEach((col) => {
    col.width = 20;
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
};

export const toPdf = (table: ReportTable): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    // Wide tables (ad performance, properties) read better landscape;
    // narrower ones (leads, payments) stay portrait.
    const landscape = table.headers.length > 6;
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: landscape ? 'landscape' : 'portrait' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    try {
      doc.image(LOGO_PATH, doc.page.margins.left, doc.page.margins.top, { width: 36 });
    } catch {
      // Missing/unreadable logo asset shouldn't break report generation --
      // the report is still useful without the crest, just less polished.
    }

    const textLeft = doc.page.margins.left + 48;
    doc
      .fillColor(BRAND_INK)
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('Chestone Properties', textLeft, doc.page.margins.top, { continued: false });
    doc
      .fillColor(BRAND_MUTED)
      .fontSize(9)
      .font('Helvetica')
      .text(`Generated ${table.generatedAt.toLocaleString('en-KE')}`, textLeft, doc.y);

    doc.moveDown(1.5);
    doc
      .strokeColor(BRAND_GOLD)
      .lineWidth(2)
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
    doc.moveDown(1);

    doc.fillColor(BRAND_INK).fontSize(14).font('Helvetica-Bold').text(table.title);
    doc.moveDown(0.5);

    if (table.summary?.length) {
      doc.fontSize(10).font('Helvetica');
      for (const s of table.summary) {
        doc.font('Helvetica-Bold').fillColor(BRAND_INK).text(`${s.label}: `, { continued: true });
        doc.font('Helvetica').fillColor(BRAND_MUTED).text(s.value);
      }
      doc.moveDown(1);
    }

    const colWidth = pageWidth / table.headers.length;
    const rowHeight = 20;

    const drawHeaderRow = () => {
      const y = doc.y;
      doc.rect(doc.page.margins.left, y, pageWidth, rowHeight).fill(BRAND_INK);
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
      table.headers.forEach((h, i) => {
        // width + height together (not width alone) is what makes pdfkit
        // truncate with an ellipsis instead of wrapping onto a second line
        // that would overlap the row below -- confirmed live: a two-word
        // header like "Assigned Agent" wrapped and bled into the first
        // data row without the height constraint.
        doc.text(h, doc.page.margins.left + i * colWidth + 4, y + 6, { width: colWidth - 8, height: rowHeight - 8, ellipsis: true });
      });
      doc.y = y + rowHeight;
    };

    drawHeaderRow();

    doc.fontSize(8.5).font('Helvetica').fillColor(BRAND_INK);
    table.rows.forEach((row, rowIndex) => {
      if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        drawHeaderRow();
        doc.fontSize(8.5).font('Helvetica').fillColor(BRAND_INK);
      }

      const y = doc.y;
      if (rowIndex % 2 === 1) {
        doc.rect(doc.page.margins.left, y, pageWidth, rowHeight).fill('#f5f2ec');
        doc.fillColor(BRAND_INK);
      }
      row.forEach((cell, i) => {
        doc.text(String(cell), doc.page.margins.left + i * colWidth + 4, y + 6, { width: colWidth - 8, height: rowHeight - 8, ellipsis: true });
      });
      doc.y = y + rowHeight;
    });

    if (table.rows.length === 0) {
      doc.fillColor(BRAND_MUTED).font('Helvetica-Oblique').text('No records match the current filters.', { align: 'center' });
    }

    doc.end();
  });
};

export const renderReport = async (format: ReportFormat, table: ReportTable): Promise<{ buffer: Buffer; contentType: string; extension: string }> => {
  if (format === 'csv') {
    return { buffer: Buffer.from(toCsv(table), 'utf-8'), contentType: 'text/csv', extension: 'csv' };
  }
  if (format === 'xlsx') {
    return { buffer: await toXlsx(table), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' };
  }
  return { buffer: await toPdf(table), contentType: 'application/pdf', extension: 'pdf' };
};
