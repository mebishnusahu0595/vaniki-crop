import mongoose from 'mongoose';

/** Maximum number of connection retry attempts */
const MAX_RETRIES = 5;

/** Delay between retries in milliseconds (doubles each attempt) */
const BASE_RETRY_DELAY_MS = 3000;

/**
 * Establishes a connection to the MongoDB database with connection pooling,
 * automatic retry on disconnect, and robust error handling.
 *
 * Uses MONGODB_URI from environment variables, falling back to a local instance.
 * Configures a connection pool of up to 10 connections for concurrency.
 *
 * @param retryCount - Internal counter for recursive retry attempts
 * @returns {Promise<void>}
 */
export async function connectDB(retryCount = 0): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vaniki-crop';

  try {
    await mongoose.connect(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    });

    console.log('✅ MongoDB connected successfully');
    console.log(`   Pool size: 10 | DB: ${mongoose.connection.db?.databaseName}`);

    // ─── Connection Event Listeners ──────────────────────────────────
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected — attempting reconnection...');
      handleReconnect();
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully');
    });
  } catch (error) {
    const err = error as Error;
    console.error(`❌ MongoDB connection failed (attempt ${retryCount + 1}/${MAX_RETRIES}):`, err.message);

    if (retryCount < MAX_RETRIES - 1) {
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCount);
      console.log(`⏳ Retrying in ${delay / 1000}s...`);
      await sleep(delay);
      return connectDB(retryCount + 1);
    }

    console.error('💀 All MongoDB connection attempts exhausted. Exiting.');
    throw error;
  }
}

/**
 * Handles automatic reconnection after an unexpected disconnect.
 * Waits briefly then calls connectDB with retry logic.
 * @returns {void}
 */
function handleReconnect(): void {
  setTimeout(() => {
    connectDB(0).catch((err) => {
      console.error('💀 Reconnection failed permanently:', err.message);
      process.exit(1);
    });
  }, BASE_RETRY_DELAY_MS);
}

/**
 * Gracefully closes the MongoDB connection.
 * Should be called on SIGINT/SIGTERM for clean shutdown.
 * @returns {Promise<void>}
 */
export async function disconnectDB(): Promise<void> {
  try {
    await mongoose.connection.close();
    console.log('🔌 MongoDB disconnected gracefully');
  } catch (error) {
    console.error('Error during MongoDB disconnect:', error);
    throw error;
  }
}

/**
 * Returns the current Mongoose connection state as a human-readable string.
 * @returns Connection state: 'disconnected' | 'connected' | 'connecting' | 'disconnecting'
 */
export function getConnectionState(): string {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
}

/**
 * Utility: delays execution for a given number of milliseconds.
 * @param ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Graceful Shutdown ─────────────────────────────────────────────────
process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDB();
  process.exit(0);
});
