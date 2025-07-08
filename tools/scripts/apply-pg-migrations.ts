import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { 
  astrophotographyImages, 
  equipment, 
  imageEquipment, 
  plateSolvingJobs, 
  adminSettings, 
  notifications 
} from '../../packages/shared/src/db/pg-schema';

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  console.log('Connecting to PostgreSQL database...');
  const connection = postgres(databaseUrl);
  const db = drizzle(connection);

  try {
    console.log('Creating tables if they don\'t exist...');
    
    // Create tables using SQL DDL since we don't have migration files
    await connection`
      CREATE TABLE IF NOT EXISTS astrophotography_images (
        id SERIAL PRIMARY KEY,
        immich_id TEXT UNIQUE,
        title TEXT NOT NULL,
        filename TEXT NOT NULL,
        thumbnail_url TEXT,
        full_url TEXT,
        capture_date TIMESTAMP,
        focal_length REAL,
        aperture TEXT,
        iso INTEGER,
        exposure_time TEXT,
        frame_count INTEGER,
        total_integration_hours REAL,
        telescope TEXT,
        camera TEXT,
        mount TEXT,
        filters TEXT,
        latitude REAL,
        longitude REAL,
        altitude REAL,
        plate_solved BOOLEAN DEFAULT false,
        ra TEXT,
        dec TEXT,
        pixel_scale REAL,
        field_of_view TEXT,
        rotation REAL,
        astrometry_job_id TEXT,
        tags TEXT[],
        object_type TEXT,
        constellation TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS equipment (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        specifications JSON,
        image_url TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS image_equipment (
        id SERIAL PRIMARY KEY,
        image_id INTEGER REFERENCES astrophotography_images(id) ON DELETE CASCADE,
        equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
        settings JSON,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS plate_solving_jobs (
        id SERIAL PRIMARY KEY,
        image_id INTEGER REFERENCES astrophotography_images(id),
        astrometry_submission_id TEXT,
        astrometry_job_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        submitted_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        result JSON
      );
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS admin_settings (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value JSON
      );
    `;

    await connection`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        details JSON,
        acknowledged BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    console.log('Database tables created successfully');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigrations().catch(console.error);