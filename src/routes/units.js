const express = require('express');
const db = require('../db');
const requireLogin = require('../middleware/authMiddleware');

const router = express.Router();

// every unit route needs a logged-in user
router.use(requireLogin);

const STATUSES = ['Vacant', 'Occupied', 'Under Repair'];

function validateUnit(body) {
    const { property_id, unit_name, monthly_rent, status } = body;

    if (!property_id || !unit_name || !String(unit_name).trim()) {
        return 'Property and unit name are required.';
    }
    if (monthly_rent === undefined || monthly_rent === '' ||
        isNaN(monthly_rent) || Number(monthly_rent) < 0) {
        return 'Monthly rent must be a number, 0 or higher.';
    }
    if (status && !STATUSES.includes(status)) {
        return 'Status must be Vacant, Occupied, or Under Repair.';
    }
    return null;
}

function handleDbError(err, res) {
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
            message: 'That unit name already exists in this property.'
        });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ message: 'Property does not exist.' });
    }
    console.error('Units database error:', err);
    return res.status(500).json({ message: 'Database error.' });
}

// VIEW ALL (active units only)
router.get('/', (req, res) => {
    const sql = `
        SELECT unit_id, property_id, unit_name, monthly_rent, status, description
        FROM units
        WHERE is_archived = 0
        ORDER BY property_id, unit_name
    `;
    db.query(sql, (err, results) => {
        if (err) return handleDbError(err, res);
        res.json(results);
    });
});

// VIEW ONE
router.get('/:id', (req, res) => {
    const sql = `
        SELECT unit_id, property_id, unit_name, monthly_rent, status, description
        FROM units
        WHERE unit_id = ? AND is_archived = 0
        LIMIT 1
    `;
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return handleDbError(err, res);
        if (results.length === 0) {
            return res.status(404).json({ message: 'Unit not found.' });
        }
        res.json(results[0]);
    });
});

// ADD
router.post('/', (req, res) => {
    const error = validateUnit(req.body);
    if (error) return res.status(400).json({ message: error });

    const { property_id, unit_name, monthly_rent, status, description } = req.body;

    const sql = `
        INSERT INTO units (property_id, unit_name, monthly_rent, status, description)
        VALUES (?, ?, ?, ?, ?)
    `;
    const values = [
        property_id,
        unit_name.trim(),
        monthly_rent,
        status || 'Vacant',
        description || null
    ];

    db.query(sql, values, (err, result) => {
        if (err) return handleDbError(err, res);
        res.status(201).json({
            message: 'Unit added.',
            unit_id: result.insertId
        });
    });
});

// EDIT
router.put('/:id', (req, res) => {
    const error = validateUnit(req.body);
    if (error) return res.status(400).json({ message: error });

    const { property_id, unit_name, monthly_rent, status, description } = req.body;

    const sql = `
        UPDATE units
        SET property_id = ?, unit_name = ?, monthly_rent = ?,
            status = ?, description = ?
        WHERE unit_id = ? AND is_archived = 0
    `;
    const values = [
        property_id,
        unit_name.trim(),
        monthly_rent,
        status || 'Vacant',
        description || null,
        req.params.id
    ];

    db.query(sql, values, (err, result) => {
        if (err) return handleDbError(err, res);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Unit not found.' });
        }
        res.json({ message: 'Unit updated.' });
    });
});

// ARCHIVE (never delete; contracts and dues point to units)
router.patch('/:id/archive', (req, res) => {
    const sql = `
        UPDATE units
        SET is_archived = 1
        WHERE unit_id = ? AND is_archived = 0
    `;
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return handleDbError(err, res);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Unit not found.' });
        }
        res.json({ message: 'Unit archived.' });
    });
});

module.exports = router;