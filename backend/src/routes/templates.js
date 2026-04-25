const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, category, is_public, created_at
       FROM templates
       WHERE user_id = $1 OR is_public = true
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching templates:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, promptTemplate, category, isPublic } = req.body;

    if (!name || !promptTemplate) {
      return res.status(400).json({ error: 'Name and prompt template are required' });
    }

    const result = await pool.query(
      `INSERT INTO templates (name, description, prompt_template, category, is_public, user_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description || '', promptTemplate, category || 'general', isPublic || false, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating template:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, description, promptTemplate, category, isPublic } = req.body;

    const result = await pool.query(
      `UPDATE templates
       SET name = $1, description = $2, prompt_template = $3, category = $4, is_public = $5
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [name, description, promptTemplate, category, isPublic, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating template:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM templates WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ message: 'Template deleted successfully' });
  } catch (err) {
    console.error('Error deleting template:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
