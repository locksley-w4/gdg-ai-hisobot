const pool = require('./database');
const bcrypt = require('bcryptjs');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        content TEXT,
        template_type VARCHAR(100),
        ai_model VARCHAR(100),
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        prompt_template TEXT NOT NULL,
        category VARCHAR(100),
        user_id INTEGER REFERENCES users(id),
        is_public BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || '123';

    const existing = await client.query(
      'SELECT id FROM users WHERE username = $1',
      [adminUsername]
    );

    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(adminPassword, 10);
      await client.query(
        'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
        [adminUsername, hash, 'admin']
      );
      console.log(`Admin user '${adminUsername}' created.`);
    } else {
      console.log(`Admin user '${adminUsername}' already exists.`);
    }

    console.log('Database migration completed successfully.');
  } catch (err) {
    console.error('Migration error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { migrate };

if (require.main === module) {
  require('dotenv').config();
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
