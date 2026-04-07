import dotenv from 'dotenv';
import app from './app.js';
import { connectDB } from './config/database.js';

const envPath = process.env.NODE_ENV === 'production' ? '../../.env.production' : '../../.env';
dotenv.config({ path: envPath });

const PORT = process.env.PORT || 5000;

/**
 * Starts the Express server after establishing a database connection.
 * @returns {Promise<void>}
 */
async function startServer(): Promise<void> {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Vaniki Crop API running on http://localhost:${PORT}`);
      console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
