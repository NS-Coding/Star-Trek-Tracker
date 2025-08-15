const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create backups directory if it doesn't exist
const backupDir = path.join(__dirname, '../backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Get database connection details from environment
const {
  POSTGRES_USER = 'postgres',
  POSTGRES_PASSWORD = 'postgres',
  POSTGRES_DB = 'startrekdb',
  POSTGRES_HOST = 'localhost',
  POSTGRES_PORT = '5432'
} = process.env;

// Create backup filename with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

// Construct the pg_dump command
const command = `pg_dump -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${POSTGRES_USER} -F c -b -v -f "${backupFile}" ${POSTGRES_DB}`;

// Execute the backup
console.log('Starting database backup...');
exec(command, { env: { ...process.env, PGPASSWORD: POSTGRES_PASSWORD } }, (error, stdout, stderr) => {
  if (error) {
    console.error('Error during backup:', error);
    process.exit(1);
  }
  
  console.log('Backup completed successfully!');
  console.log(`Backup saved to: ${backupFile}`);
  
  // Keep only the last 5 backups
  const files = fs.readdirSync(backupDir)
    .filter(file => file.startsWith('backup-'))
    .sort()
    .reverse();
    
  if (files.length > 5) {
    files.slice(5).forEach(file => {
      fs.unlinkSync(path.join(backupDir, file));
      console.log(`Removed old backup: ${file}`);
    });
  }
});
