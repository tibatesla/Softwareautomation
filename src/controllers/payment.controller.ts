// src/controllers/payment.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { withRLSContext, AppRole } from '../config/database';
import { createPaymentSchema, updatePaymentSchema, bulkDeleteSchema } from '../schemas/payment.schema';

export const listPayments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const payments = await withRLSContext(id, role, (tx) =>
    tx.payment.findMany({ orderBy: { createdAt: 'desc' } }),
  );
  res.status(200).json(payments);
};

export const getPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const payment = await withRLSContext(id, role, (tx) =>
    tx.payment.findUnique({ where: { id: req.params.id } }),
  );

  if (!payment) {
    res.status(404).json({ error: 'Payment not found' });
    return;
  }

  res.status(200).json(payment);
};

/**
 * Payments are a record-keeping ledger (no payment gateway, no funds move
 * through this app). Updates and deletes (see below) are both Owner-only --
 * updates for correcting typos rather than general editing, deletes for
 * removing a record entirely. recordedBy is always the authenticated
 * caller, never client-supplied, so the audit trail can't be forged.
 */
export const createPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = createPaymentSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed payment payload', details: parseResult.error.errors });
    return;
  }

  const { id, role } = req.user!;

  try {
    const payment = await withRLSContext(id, role, (tx) =>
      tx.payment.create({ data: { ...parseResult.data, recordedBy: id } }),
    );
    res.status(201).json(payment);
  } catch {
    res.status(400).json({ error: 'Unable to record payment -- check propertyId/leadId reference valid records, and that the property is assigned to you' });
  }
};

/**
 * Owner-only (route + payments_owner_update RLS policy both enforce this).
 * Never accepts propertyId/leadId/recordedBy -- only correction of the
 * amount/method/date/notes on an existing record.
 */
export const updatePayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = updatePaymentSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed payment payload', details: parseResult.error.errors });
    return;
  }

  const { id, role } = req.user!;

  try {
    const payment = await withRLSContext(id, role, (tx) =>
      tx.payment.update({ where: { id: req.params.id }, data: parseResult.data }),
    );
    res.status(200).json(payment);
  } catch {
    res.status(404).json({ error: 'Payment not found' });
  }
};

/**
 * Owner-only (route + payments_owner_delete RLS policy both enforce this),
 * same access shape as updatePayment. Nothing else references a payment
 * as a foreign key, so unlike deleteProperty/deleteLead there's no
 * linked-record check needed -- a payment is always a leaf row.
 */
const deletePaymentCore = async (userId: string, role: AppRole, paymentId: string): Promise<boolean> => {
  try {
    await withRLSContext(userId, role, (tx) => tx.payment.delete({ where: { id: paymentId } }));
    return true;
  } catch {
    return false;
  }
};

export const deletePayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const ok = await deletePaymentCore(id, role, req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Payment not found' });
    return;
  }
  res.status(204).send();
};

export const bulkDeletePayments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = bulkDeleteSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed request', details: parseResult.error.errors });
    return;
  }

  const { id, role } = req.user!;
  const results = await Promise.all(
    parseResult.data.ids.map(async (paymentId) => {
      const ok = await deletePaymentCore(id, role, paymentId);
      return ok
        ? { id: paymentId, deleted: true as const }
        : { id: paymentId, deleted: false as const, error: 'Payment not found' };
    }),
  );

  res.status(200).json({
    deleted: results.filter((r) => r.deleted).map((r) => r.id),
    failed: results.filter((r): r is { id: string; deleted: false; error: string } => !r.deleted),
  });
};
