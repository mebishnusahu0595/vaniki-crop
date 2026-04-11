import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';
import { connectDB } from './config/database.js';
import { configureCloudinary } from './config/cloudinary.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFilePath);
const envPath = process.env.NODE_ENV === 'production'
  ? resolve(currentDirectory, '../../../.env.production')
  : resolve(currentDirectory, '../../../.env');
dotenv.config({ path: envPath });
configureCloudinary();

const PORT = process.env.PORT || 5000;

/**
 * Starts the Express server after establishing a database connection.
 * @returns {Promise<void>}
 */
async function startServer(): Promise<void> {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Vaniki Crop API running on port ${PORT}`);
      console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
