import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let memoryServer;

export async function connectDB() {
  const uri = process.env.MONGODB_URI?.trim();
  try {
    if (uri) {
      await mongoose.connect(uri);
      console.log('MongoDB connected:', uri.replace(/\/\/.*@/, '//<credentials>@'));
      return;
    }
  } catch (err) {
    console.warn('MONGODB_URI connection failed, falling back to in-memory MongoDB:', err.message);
  }

  memoryServer = await MongoMemoryServer.create({ instance: { dbName: 'civictrack' } });
  const memUri = memoryServer.getUri();
  await mongoose.connect(memUri);
  console.log('MongoDB Memory Server connected');
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
