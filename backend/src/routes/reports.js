const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { generateReport } = require('../services/vertexai');

const router = express.Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, template_type, ai_model, created_at FROM reports WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching reports:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching report:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const { title, prompt, templateType, model } = req.body;

    if (!title || !prompt) {
      return res.status(400).json({ error: 'Title and prompt are required' });
    }

    const aiModel = model || process.env.VERTEX_AI_MODEL || 'gemini-1.5-pro';
    const content = await generateReport(prompt, aiModel);

    const result = await pool.query(
      `INSERT INTO reports (title, content, template_type, ai_model, user_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, content, templateType || 'custom', aiModel, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error generating report:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate report' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM reports WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json({ message: 'Report deleted successfully' });
  } catch (err) {
    console.error('Error deleting report:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
