import fs from 'fs/promises';
import path from 'path';
import cloudinary, { cloudinaryEnabled } from '../config/cloudinary.js';

function geoFields(meta = {}) {
  const geo = {};
  if (meta.latitude != null && meta.longitude != null) {
    geo.latitude = meta.latitude;
    geo.longitude = meta.longitude;
  }
  if (meta.accuracy != null) geo.accuracy = meta.accuracy;
  if (meta.address) geo.address = meta.address;
  if (meta.capturedAt) geo.capturedAt = meta.capturedAt;
  return geo;
}

export async function storeMediaFile(file, req, meta = {}) {
  if (cloudinaryEnabled) {
    const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'image';
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'civictrack/complaints',
      resource_type: resourceType,
    });
    await fs.unlink(file.path).catch(() => {});
    return {
      url: result.secure_url,
      publicId: result.public_id,
      type: resourceType,
      filename: file.originalname,
      size: file.size,
      ...geoFields(meta),
    };
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return {
    url: `${baseUrl}/uploads/${path.basename(file.path)}`,
    publicId: '',
    type: file.mimetype.startsWith('video/') ? 'video' : 'image',
    filename: file.originalname,
    size: file.size,
    ...geoFields(meta),
  };
}

export async function removeMediaFile(media) {
  if (cloudinaryEnabled && media.publicId) {
    await cloudinary.uploader.destroy(media.publicId, {
      resource_type: media.type === 'video' ? 'video' : 'image',
    }).catch(() => {});
    return;
  }
  if (media.url?.includes('/uploads/')) {
    const filename = media.url.split('/uploads/').pop();
    const filePath = path.resolve('src/uploads', filename);
    await fs.unlink(filePath).catch(() => {});
  }
}
