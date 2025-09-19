/**
 * Database reset script for Vercel
 * This script completely resets the database schema
 * WARNING: This will delete all data!
 */

const { getVercelDatabase } = require('../lib/vercel-init-db');

async function resetDatabase() {
  try {
    console.log('⚠️ WARNING: This will delete ALL data in the database!');
    console.log('🔧 Starting database reset...');
    
    const { sequelize } = await getVercelDatabase(process.env.DATABASE_URL);
    
    // Drop all tables
    console.log('🗑️ Dropping all tables...');
    await sequelize.query('DROP SCHEMA public CASCADE;');
    await sequelize.query('CREATE SCHEMA public;');
    await sequelize.query('GRANT ALL ON SCHEMA public TO postgres;');
    await sequelize.query('GRANT ALL ON SCHEMA public TO public;');
    
    console.log('✅ All tables dropped');
    
    // Force sync to recreate tables
    console.log('🔧 Recreating tables...');
    await sequelize.sync({ force: true });
    
    console.log('✅ Database reset completed successfully');
    console.log('👤 Default admin credentials:');
    console.log('   Username: admin@diskominfo-bogor.go.id');
    console.log('   Password: admin123');
    
    await sequelize.close();
    
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
}

// Run the reset if this script is executed directly
if (require.main === module) {
  resetDatabase();
}

module.exports = { resetDatabase };
