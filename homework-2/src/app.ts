import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import { CreateTicketInputSchema, UpdateTicketInputSchema } from './models/ticket';
import { createTicket, getTicket, listTickets, updateTicket, deleteTicket } from './store/ticketStore';
import { classify } from './classifier';
import { HttpError, errorHandler } from './errors';
import type { TicketFilters, InternalUpdateInput } from './store/ticketStore';
import { parseCSV } from './importers/csvImporter';
import { parseJSON } from './importers/jsonImporter';
import { parseXML } from './importers/xmlImporter';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
app.use(express.json());

// POST /tickets
app.post('/tickets', (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreateTicketInputSchema.parse(req.body);
    let ticket = createTicket(input);

    if (req.query['auto_classify'] === 'true') {
      const classification = classify(ticket.subject, ticket.description);
      console.info({ ticketId: ticket.id, classification }, 'classified');
      const patch: InternalUpdateInput = {
        category: classification.category,
        priority: classification.priority,
        last_classification: classification,
      };
      ticket = updateTicket(ticket.id, patch) ?? ticket;
    }

    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
});

// POST /tickets/import
app.post('/tickets/import', upload.single('file'), (async (req, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Import file is required.');
    }

    const rows = await parseImportFile(req.file.originalname, req.file.buffer);
    const autoClassify = req.query['auto_classify'] === 'true';
    const failed: Array<{ row: number; error: string; raw: Record<string, unknown> }> = [];
    let successful = 0;
    let classified = 0;

    rows.forEach((raw, index) => {
      try {
        const input = CreateTicketInputSchema.parse(raw);
        let ticket = createTicket(input);

        if (autoClassify) {
          const classification = classify(ticket.subject, ticket.description);
          console.info({ ticketId: ticket.id, classification }, 'classified');
          ticket = updateTicket(ticket.id, {
            category: classification.category,
            priority: classification.priority,
            last_classification: classification,
          }) ?? ticket;
          classified += 1;
        }

        successful += 1;
      } catch (err) {
        failed.push({
          row: index + 1,
          error: err instanceof Error ? err.message : 'Invalid ticket row.',
          raw,
        });
      }
    });

    res.status(failed.length > 0 ? 207 : 200).json({
      total: rows.length,
      successful,
      classified,
      failed,
    });
  } catch (err) {
    next(normalizeImportError(err));
  }
}) as RequestHandler);

// GET /tickets
app.get('/tickets', (req: Request, res: Response) => {
  const filters: TicketFilters = {};
  if (req.query['category']) filters.category = req.query['category'] as TicketFilters['category'];
  if (req.query['priority']) filters.priority = req.query['priority'] as TicketFilters['priority'];
  if (req.query['status']) filters.status = req.query['status'] as TicketFilters['status'];
  if (req.query['assigned_to']) filters.assigned_to = req.query['assigned_to'] as string;
  res.json(listTickets(filters));
});

// GET /tickets/:id
app.get('/tickets/:id', ((req, res, next) => {
  const id = String(req.params.id);
  const ticket = getTicket(id);
  if (!ticket) return next(new HttpError(404, 'NOT_FOUND', 'Ticket not found.'));
  res.json(ticket);
}) as RequestHandler);

// PUT /tickets/:id
app.put('/tickets/:id', ((req, res, next) => {
  try {
    const id = String(req.params.id);
    const input = UpdateTicketInputSchema.parse(req.body);
    const ticket = updateTicket(id, input);
    if (!ticket) return next(new HttpError(404, 'NOT_FOUND', 'Ticket not found.'));
    res.json(ticket);
  } catch (err) {
    next(err);
  }
}) as RequestHandler);

// DELETE /tickets/:id
app.delete('/tickets/:id', ((req, res, next) => {
  const id = String(req.params.id);
  const deleted = deleteTicket(id);
  if (!deleted) return next(new HttpError(404, 'NOT_FOUND', 'Ticket not found.'));
  res.status(204).send();
}) as RequestHandler);

// POST /tickets/:id/auto-classify
app.post('/tickets/:id/auto-classify', ((req, res, next) => {
  const id = String(req.params.id);
  const ticket = getTicket(id);
  if (!ticket) return next(new HttpError(404, 'NOT_FOUND', 'Ticket not found.'));

  const classification = classify(ticket.subject, ticket.description);
  console.info({ ticketId: id, classification }, 'classified');
  const patch: InternalUpdateInput = {
    category: classification.category,
    priority: classification.priority,
    last_classification: classification,
  };
  const updated = updateTicket(id, patch);

  res.json({ ticket: updated, classification });
}) as RequestHandler);

app.use(errorHandler);

export default app;

async function parseImportFile(filename: string, buffer: Buffer): Promise<Record<string, unknown>[]> {
  const extension = path.extname(filename).toLowerCase();

  switch (extension) {
    case '.csv':
      return parseCSV(buffer);
    case '.json':
      return parseJSON(buffer);
    case '.xml':
      return parseXML(buffer);
    default:
      throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported import format.');
  }
}

function normalizeImportError(err: unknown): HttpError | unknown {
  if (err instanceof HttpError) {
    return err;
  }

  if (err instanceof Error) {
    return new HttpError(400, 'VALIDATION_ERROR', err.message);
  }

  return err;
}
