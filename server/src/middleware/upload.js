import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';

const uploadDir = path.resolve('src/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${uuid()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const allowed = /jpeg|jpg|png|webp|gif|mp4|webm|mov|quicktime/;
  const ext = path.extname(file.originalname || '').toLowerCase().replace('.', '');
  const mimeOk = allowed.test(file.mimetype) || allowed.test(ext);
  if (mimeOk) return cb(null, true);
  cb(new Error('Only image and video files are allowed'));
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024, files: 6 },
});
