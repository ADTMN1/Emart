import multer from 'multer';
import { BadRequestError } from '../utils/errors';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

// Configure multer to use memory storage
const storage = multer.memoryStorage();

// File filter
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestError(`Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`));
  }
};

// Create multer upload instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Single file upload at a time
  },
});

// Middleware for single image upload
export const uploadSingle = upload.single('image');

// CSV upload for bulk-import validation (spec Phase 2).
// Size cap matches MAX_CSV_BYTES in services/import/csv-parser.
const MAX_CSV_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const csvUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Browsers report inconsistent MIME types for CSV (text/csv, text/plain,
    // application/vnd.ms-excel), so the extension is the reliable signal.
    const name = (file.originalname || '').toLowerCase();
    if (name.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Invalid file type. Upload a .csv file'));
    }
  },
  limits: {
    fileSize: MAX_CSV_FILE_SIZE,
    files: 1,
  },
});

export const uploadCsvSingle = csvUpload.single('file');

// CSV plus an optional image ZIP for the CREATE import.  Entries are never
// extracted to disk; the ZIP is inspected in memory by the import service.
const importUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const name = (file.originalname || '').toLowerCase();
    if (file.fieldname === 'file' && name.endsWith('.csv')) return cb(null, true);
    if (file.fieldname === 'imagesZip' && name.endsWith('.zip')) return cb(null, true);
    cb(new BadRequestError('Upload a .csv file and an optional .zip image archive'));
  },
  limits: { fileSize: 30 * 1024 * 1024, files: 2 },
});

export const uploadImportFiles = importUpload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'imagesZip', maxCount: 1 },
]);
