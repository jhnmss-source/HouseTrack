
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');

const router = express.Router();

// LOGIN
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: 'Email and password are required.'
        });
    }

    const sql = `
        SELECT user_id, full_name, email,
               password_hash, role, status
        FROM users
        WHERE email = ?
        LIMIT 1
    `;

    db.query(sql, [email.trim()], async (err, results) => {
        if (err) {
            console.error('Login database error:', err);
            return res.status(500).json({
                message: 'Database error.'
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        const user = results[0];

        if (user.status !== 'Active') {
            return res.status(403).json({
                message: 'Your account is inactive.'
            });
        }

        try {
            const isMatch = await bcrypt.compare(
                password,
                user.password_hash
            );

            if (!isMatch) {
                return res.status(401).json({
                    message: 'Invalid email or password.'
                });
            }

            req.session.regenerate((err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({
                        message: 'Unable to create session.'
                    });
                }

                req.session.user = {
                    user_id: user.user_id,
                    full_name: user.full_name,
                    email: user.email,
                    role: user.role
                };

                req.session.save((err) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({
                            message: 'Unable to save session.'
                        });
                    }

                    res.json({
                        message: 'Login successful!',
                        redirect: '/dashboard.html'
                    });
                });
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({
                message: 'Authentication error.'
            });
        }
    });
});

// LOGOUT
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                message: 'Logout failed.'
            });
        }

        res.clearCookie('connect.sid');

        res.json({
            message: 'Logged out successfully.'
        });
    });
});

module.exports = router;
