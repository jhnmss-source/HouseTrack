const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const db = require('../db').promise();

// View + search (active tenants only)
router.get('/', async (req, res) => {
  try {
    const q = `%${req.query.q || ''}%`;
    const [rows] = await db.query(
      `SELECT t.tenant_id, u.full_name, u.email, t.contact_number,
              t.emergency_contact_name, t.emergency_contact_number, t.valid_id_type
       FROM tenants t
       JOIN users u ON u.user_id = t.user_id
       WHERE u.status = 'Active'
         AND (u.full_name LIKE ? OR u.email LIKE ?)
       ORDER BY u.full_name`, [q, q]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load tenants.' });
  }
});

// Add
router.post('/', async (req, res) => {
  const { full_name, email, password, contact_number,
          emergency_contact_name, emergency_contact_number, valid_id_type } = req.body;

  if (!full_name || !email || !password || !contact_number) {
    return res.status(400).json({ error: 'Name, email, password, and contact number are required.' });
  }

  try {
    await db.beginTransaction();
    const hash = await bcrypt.hash(password, 10);
    const [u] = await db.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES (?, ?, ?, 'Tenant')`, [full_name, email, hash]);
    const [t] = await db.query(
      `INSERT INTO tenants (user_id, contact_number, emergency_contact_name,
                            emergency_contact_number, valid_id_type)
       VALUES (?, ?, ?, ?, ?)`,
      [u.insertId, contact_number, emergency_contact_name || null,
       emergency_contact_number || null, valid_id_type || null]);
    await db.commit();
    res.json({ tenant_id: t.insertId });
  } catch (err) {
    await db.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'That email is already used.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Could not add tenant.' });
  }
});

// Edit
router.put('/:id', async (req, res) => {
  const { full_name, email, contact_number,
          emergency_contact_name, emergency_contact_number, valid_id_type } = req.body;

  if (!full_name || !email || !contact_number) {
    return res.status(400).json({ error: 'Name, email, and contact number are required.' });
  }

  try {
    await db.query(
      `UPDATE users u JOIN tenants t ON t.user_id = u.user_id
       SET u.full_name = ?, u.email = ?
       WHERE t.tenant_id = ?`, [full_name, email, req.params.id]);
    await db.query(
      `UPDATE tenants SET contact_number = ?, emergency_contact_name = ?,
              emergency_contact_number = ?, valid_id_type = ?
       WHERE tenant_id = ?`,
      [contact_number, emergency_contact_name || null,
       emergency_contact_number || null, valid_id_type || null, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'That email is already used.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Could not update tenant.' });
  }
});

// Archive (not delete)
router.put('/:id/archive', async (req, res) => {
  try {
    await db.query(
      `UPDATE users u JOIN tenants t ON t.user_id = u.user_id
       SET u.status = 'Inactive'
       WHERE t.tenant_id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not archive tenant.' });
  }
});

module.exports = router;