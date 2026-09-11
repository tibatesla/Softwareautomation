// src/controllers/report.controller.ts
//
// Downloadable CSV/Excel/PDF reports for Properties, Leads, Payments, and
// Ad Performance. Each handler fetches through the exact same
// withRLSContext-scoped query shape as that resource's existing list
// endpoint (so an agent can only ever export what they can already see in
// the CRM), then shapes the rows into a generic ReportTable for
// report-generation.service.ts to render.
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { withRLSContext } from '../config/database';
import { renderReport, ReportFormat, ReportTable } from '../services/report-generation.service';
import { computeAgentPerformance } from '../services/agent-performance.service';

const VALID_FORMATS: ReportFormat[] = ['csv', 'xlsx', 'pdf'];

const parseFormat = (req: AuthenticatedRequest): ReportFormat | null => {
  const raw = typeof req.query.format === 'string' ? req.query.format : 'csv';
  return (VALID_FORMATS as string[]).includes(raw) ? (raw as ReportFormat) : null;
};

const sendReport = async (res: Response, format: ReportFormat, table: ReportTable, filenameBase: string): Promise<void> => {
  const { buffer, contentType, extension } = await renderReport(format, table);
  const dateStamp = table.generatedAt.toISOString().slice(0, 10);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}-${dateStamp}.${extension}"`);
  res.status(200).send(buffer);
};

const formatMoney = (amount: number | string | { toString(): string }, currency: string): string => {
  try {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(amount));
  } catch {
    return `${currency} ${amount}`;
  }
};

export const reportProperties = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const format = parseFormat(req);
  if (!format) {
    res.status(400).json({ error: 'Invalid format -- expected csv, xlsx, or pdf' });
    return;
  }

  const { id, role } = req.user!;
  const properties = await withRLSContext(id, role, (tx) =>
    tx.property.findMany({
      orderBy: { createdAt: 'desc' },
      include: { assignedAgent: { select: { fullName: true } } },
    }),
  );

  const generatedAt = new Date();
  const table: ReportTable = {
    title: 'Property Listings Report',
    generatedAt,
    summary: [
      { label: 'Total properties', value: String(properties.length) },
      { label: 'Posted to social', value: String(properties.filter((p) => p.socialPostedAt).length) },
    ],
    headers: ['Title', 'Development', 'Location', 'Status', 'Price', 'Unit Type', 'Size (sqft)', 'Assigned Agent', 'Posted to Social', 'Created'],
    rows: properties.map((p) => [
      p.title,
      p.developmentName ?? '-',
      [p.location, p.subLocation].filter(Boolean).join(', ') || '-',
      p.status,
      formatMoney(p.price, p.currency),
      p.unitType ?? '-',
      p.houseSizeSqft ? Number(p.houseSizeSqft) : '-',
      p.assignedAgent?.fullName ?? '-',
      p.socialPostedAt ? 'Yes' : 'No',
      p.createdAt.toISOString().slice(0, 10),
    ]),
  };

  await sendReport(res, format, table, 'properties-report');
};

export const reportLeads = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const format = parseFormat(req);
  if (!format) {
    res.status(400).json({ error: 'Invalid format -- expected csv, xlsx, or pdf' });
    return;
  }

  const { id, role } = req.user!;
  const leads = await withRLSContext(id, role, (tx) =>
    tx.lead.findMany({
      orderBy: { createdAt: 'desc' },
      include: { claimedByAgent: { select: { fullName: true } }, property: { select: { title: true } } },
    }),
  );

  const generatedAt = new Date();
  const table: ReportTable = {
    title: 'Leads Report',
    generatedAt,
    summary: [
      { label: 'Total leads', value: String(leads.length) },
      { label: 'Qualified', value: String(leads.filter((l) => l.qualificationStatus === 'qualified').length) },
    ],
    headers: ['Name', 'Phone', 'Email', 'Source', 'Qualification', 'Deal Stage', 'Budget Range', 'Interested Property', 'Claimed By', 'Created'],
    rows: leads.map((l) => [
      l.fullName ?? '-',
      l.phoneNumber,
      l.email ?? '-',
      l.source ?? '-',
      l.qualificationStatus,
      l.dealStage,
      l.budgetRange ?? '-',
      l.property?.title ?? '-',
      l.claimedByAgent?.fullName ?? '-',
      l.createdAt.toISOString().slice(0, 10),
    ]),
  };

  await sendReport(res, format, table, 'leads-report');
};

export const reportPayments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const format = parseFormat(req);
  if (!format) {
    res.status(400).json({ error: 'Invalid format -- expected csv, xlsx, or pdf' });
    return;
  }

  const { id, role } = req.user!;
  const payments = await withRLSContext(id, role, (tx) =>
    tx.payment.findMany({
      orderBy: { paymentDate: 'desc' },
      include: {
        property: { select: { title: true } },
        lead: { select: { fullName: true, phoneNumber: true } },
        recorder: { select: { fullName: true } },
      },
    }),
  );

  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const generatedAt = new Date();
  const table: ReportTable = {
    title: 'Payments Report',
    generatedAt,
    summary: [
      { label: 'Total payments', value: String(payments.length) },
      { label: 'Total amount', value: formatMoney(totalAmount, 'KES') },
      { label: 'Deposits recorded', value: String(payments.filter((p) => p.isDeposit).length) },
    ],
    headers: ['Date', 'Payer', 'Property', 'Lead', 'Amount', 'Method', 'Deposit', 'Recorded By', 'Notes'],
    rows: payments.map((p) => [
      p.paymentDate.toISOString().slice(0, 10),
      p.payerType,
      p.property?.title ?? '-',
      p.lead?.fullName ?? p.lead?.phoneNumber ?? '-',
      formatMoney(p.amount, p.currency),
      p.paymentMethod ?? '-',
      p.isDeposit ? 'Yes' : 'No',
      p.recorder?.fullName ?? '-',
      p.notes ?? '-',
    ]),
  };

  await sendReport(res, format, table, 'payments-report');
};

export const reportAdPerformance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const format = parseFormat(req);
  if (!format) {
    res.status(400).json({ error: 'Invalid format -- expected csv, xlsx, or pdf' });
    return;
  }

  const { id, role } = req.user!;
  const platform = typeof req.query.platform === 'string' ? req.query.platform : undefined;

  const logs = await withRLSContext(id, role, (tx) =>
    tx.adPerformanceLog.findMany({
      where: platform ? { platform: platform as 'meta' | 'google' | 'tiktok' } : undefined,
      orderBy: { windowStart: 'desc' },
      take: 1000,
    }),
  );

  const totalSpend = logs.reduce((sum, l) => sum + Number(l.spend), 0);
  const totalLeads = logs.reduce((sum, l) => sum + l.qualifiedLeads, 0);
  const generatedAt = new Date();
  const table: ReportTable = {
    title: 'Ad Performance Report',
    generatedAt,
    summary: [
      { label: 'Total spend', value: formatMoney(totalSpend, 'KES') },
      { label: 'Qualified leads', value: String(totalLeads) },
      { label: 'Rows', value: String(logs.length) },
    ],
    headers: ['Platform', 'Campaign ID', 'Ad ID', 'Window', 'Impressions', 'Clicks', 'CTR %', 'Spend', 'Qualified Leads', 'Cost/Lead'],
    rows: logs.map((l) => [
      l.platform,
      l.campaignId,
      l.adId,
      l.windowStart.toISOString().slice(0, 13).replace('T', ' ') + 'h',
      l.impressions,
      l.clicks,
      l.ctr ? Number(l.ctr).toFixed(2) : '-',
      formatMoney(l.spend, l.currency),
      l.qualifiedLeads,
      l.cpql ? formatMoney(l.cpql, l.currency) : '-',
    ]),
  };

  await sendReport(res, format, table, 'ad-performance-report');
};

export const reportAgentPerformance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const format = parseFormat(req);
  if (!format) {
    res.status(400).json({ error: 'Invalid format -- expected csv, xlsx, or pdf' });
    return;
  }

  const { id, role } = req.user!;
  const { agents } = await computeAgentPerformance(id, role);

  const generatedAt = new Date();
  const table: ReportTable = {
    title: 'Agent Performance Report',
    generatedAt,
    summary: [
      { label: 'Agents', value: String(agents.length) },
      { label: 'Total leads claimed', value: String(agents.reduce((sum, a) => sum + a.leadsClaimed, 0)) },
      { label: 'Total revenue closed', value: formatMoney(agents.reduce((sum, a) => sum + a.revenueClosed, 0), 'KES') },
    ],
    headers: ['Agent', 'On Duty', 'Leads Claimed', 'Qualified', 'Converted', 'Bookings Completed', 'Bookings Missed', 'SLA Violations', 'Revenue Closed'],
    rows: agents.map((a) => [
      a.fullName,
      a.isOnDuty ? 'Yes' : 'No',
      a.leadsClaimed,
      a.leadsQualified,
      a.leadsConverted,
      a.bookingsCompleted,
      a.bookingsMissed,
      a.slaViolations,
      formatMoney(a.revenueClosed, 'KES'),
    ]),
  };

  await sendReport(res, format, table, 'agent-performance-report');
};
