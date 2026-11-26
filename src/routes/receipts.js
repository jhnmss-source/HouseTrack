const express = require('express');
const db = require('../db');
const requireLogin = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireLogin);

const BASE_SQL = `
    SELECT r.receipt_id, r.receipt_number, r.issued_at,
           p.payment_id, p.amount, p.payment_date, p.method,
           p.reference_number, p.status AS payment_status,
           d.description AS due_description, d.billing_month,
           tu.full_name AS tenant_name,
           un.unit_name,
           iu.full_name AS issued_by_name
    FROM receipts r
    JOIN payments p ON p.payment_id = r.payment_id
    JOIN dues d ON d.due_id = p.due_id
    JOIN rental_contracts c ON c.contract_id = d.contract_id
    JOIN tenants t ON t.tenant_id = c.tenant_id
    JOIN users tu ON tu.user_id = t.user_id
    JOIN units un ON un.unit_id = c.unit_id
    JOIN users iu ON iu.user_id = r.issued_by
`;

// LIST + SEARCH + FILTER
// /api/receipts?q=text&method=GCash&from=2026-01-01&to=2026-12-31
router.get('/', (req, res) => {
    const { q, method, from, to } = req.query;
    const where = [];
    const values = [];

    if (q && q.trim()) {
        where.push('(r.receipt_number LIKE ? OR tu.full_name LIKE ? OR un.unit_name LIKE ?)');
        const like = '%' + q.trim() + '%';
        values.push(like, like, like);
    }
    if (method) {
        where.push('p.method = ?');
        values.push(method);
    }
    if (from) {
        where.push('p.payment_date >= ?');
        values.push(from);
    }
    if (to) {
        where.push('p.payment_date <= ?');
        values.push(to);
    }

    const sql = BASE_SQL +
        (where.length ? ' WHERE ' + where.join(' AND ') : '') +
        ' ORDER BY r.issued_at DESC';

    db.query(sql, values, (err, results) => {
        if (err) {
            console.error('Receipts database error:', err);
            return res.status(500).json({ error: 'Database error.' });
        }
        res.json(results);
    });
});

// VIEW ONE (for the printable page)
router.get('/:id', (req, res) => {
    db.query(BASE_SQL + ' WHERE r.receipt_id = ? LIMIT 1', [req.params.id], (err, results) => {
        if (err) {
            console.error('Receipts database error:', err);
            return res.status(500).json({ error: 'Database error.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Receipt not found.' });
        }
        res.json(results[0]);
    });
});

module.exports = router;